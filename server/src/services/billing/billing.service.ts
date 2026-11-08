import { and, desc, eq, gt, inArray } from 'drizzle-orm';
import { db } from '../../db';
import {
  billingPlans,
  profiles,
  subscriptionEvents,
  subscriptions,
  type BillingPlan,
  type Subscription,
} from '../../db/schema';
import { env } from '../../config/env';
import { AppError } from '../../utils/app-error';
import {
  razorpay,
  razorpayConfigured,
  validCheckoutSignature,
  type RzpSubscription,
} from './razorpay.client';

/** Mochi's Club: ₹149 a month. Created on Razorpay once, then read from billing_plans. */
const CLUB = {
  key: 'club_monthly',
  name: "Mochi's Club",
  amountPaise: 14_900,
  period: 'monthly',
  interval: 1,
};
/** 120 monthly charges (10 years): accepted by every payment method Razorpay offers. */
const TOTAL_CHARGES = 120;
/** Statuses where autopay is still on (a new subscription must not be started). */
const AUTOPAY_ON = ['created', 'authenticated', 'active', 'pending'];

const fromUnix = (s: number | null | undefined) => (s ? new Date(s * 1000) : null);

/** Copies Razorpay's view of a subscription onto our row (the source of truth for dates). */
function fromRazorpay(r: RzpSubscription) {
  return {
    status: r.status,
    startAt: fromUnix(r.start_at),
    // Paid through: the current cycle's end once a charge has gone through.
    nextBillAt: r.paid_count > 0 ? fromUnix(r.current_end) : null,
    endsAt: fromUnix(r.end_at),
    paidCount: r.paid_count,
    updatedAt: new Date(),
  };
}

async function clubPlan(): Promise<BillingPlan> {
  const [existing] = await db.select().from(billingPlans).where(eq(billingPlans.key, CLUB.key));
  if (existing) return existing;
  const created = await razorpay.createPlan(CLUB);
  const [row] = await db
    .insert(billingPlans)
    .values({ ...CLUB, razorpayPlanId: created.id })
    .onConflictDoNothing({ target: billingPlans.key })
    .returning();
  // Two first requests at once: the other one stored it; read it back.
  return row ?? (await db.select().from(billingPlans).where(eq(billingPlans.key, CLUB.key)))[0]!;
}

/** Has access right now: a charge went through and the paid-through date is ahead. */
const hasAccess = (s: Subscription, now = new Date()) =>
  s.paidCount > 0 && s.nextBillAt !== null && s.nextBillAt > now;

async function subscriptionsOf(profileId: string) {
  return db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.profileId, profileId))
    .orderBy(desc(subscriptions.createdAt));
}

function view(s: Subscription | undefined) {
  if (!s) return null;
  return {
    id: s.id,
    status: s.status,
    startAt: s.startAt,
    nextBillAt: s.nextBillAt,
    endsAt: s.endsAt,
    autoRenew: s.autoRenew,
    cancelledAt: s.cancelledAt,
  };
}

export const billingService = {
  /** Is this profile in the Club right now? (Used to lift the assistant's free limit.) */
  async isPremium(profileId: string) {
    const rows = await db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.profileId, profileId), gt(subscriptions.nextBillAt, new Date())));
    return rows.some((s) => hasAccess(s));
  },

  /** Plan, access, the current and any upcoming subscription. */
  async summary(profileId: string) {
    const rows = await subscriptionsOf(profileId);
    const current = rows.find((s) => hasAccess(s));
    // Taken while paid-up, scheduled to start later, not charged yet.
    const upcoming = rows.find(
      (s) => s !== current && s.paidCount === 0 && s.status === 'authenticated',
    );
    return {
      configured: razorpayConfigured(),
      plan: { name: CLUB.name, amountPaise: CLUB.amountPaise, period: CLUB.period },
      premium: Boolean(current),
      current: view(current),
      upcoming: view(upcoming),
    };
  },

  /**
   * Starts (or reuses) a subscription for checkout. Blocked while autopay is on. If the user
   * still has paid days (they cancelled), the new one starts when those run out.
   */
  async checkout(profileId: string) {
    const rows = await subscriptionsOf(profileId);
    const live = rows.find((s) => AUTOPAY_ON.includes(s.status) && s.autoRenew);
    if (live && (hasAccess(live) || live.status === 'authenticated')) {
      throw new AppError(409, 'You’re already in Mochi’s Club.');
    }
    // An unfinished checkout from before: reuse it instead of creating another.
    if (live && live.status === 'created') {
      return { subscriptionId: live.razorpaySubscriptionId, keyId: env.RAZORPAY_KEY_ID! };
    }

    const plan = await clubPlan();
    const paidUntil = rows.find((s) => hasAccess(s))?.nextBillAt;
    const created = await razorpay.createSubscription({
      planId: plan.razorpayPlanId,
      totalCount: TOTAL_CHARGES,
      startAt: paidUntil ? Math.floor(paidUntil.getTime() / 1000) : undefined,
      notes: { profileId },
    });
    await db.insert(subscriptions).values({
      profileId,
      planId: plan.id,
      razorpaySubscriptionId: created.id,
      ...fromRazorpay(created),
    });
    return { subscriptionId: created.id, keyId: env.RAZORPAY_KEY_ID! };
  },

  /** The page the app's WebView opens: Razorpay Checkout for this subscription. */
  async checkoutPage(profileId: string, razorpaySubscriptionId: string) {
    const [row] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.profileId, profileId),
          eq(subscriptions.razorpaySubscriptionId, razorpaySubscriptionId),
        ),
      );
    if (!row) throw AppError.notFound('Subscription');
    const [profile] = await db
      .select({ name: profiles.name })
      .from(profiles)
      .where(eq(profiles.id, profileId));
    return {
      keyId: env.RAZORPAY_KEY_ID!,
      subscriptionId: razorpaySubscriptionId,
      name: profile?.name ?? '',
      planName: CLUB.name,
      price: `₹${CLUB.amountPaise / 100}/month`,
    };
  },

  /**
   * Checkout success from the app: check Razorpay's signature, then read the subscription back
   * from Razorpay so dates and paid count come from them, not the client.
   */
  async verify(
    profileId: string,
    input: { paymentId: string; subscriptionId: string; signature: string },
  ) {
    if (!validCheckoutSignature(input.paymentId, input.subscriptionId, input.signature)) {
      throw new AppError(
        400,
        'We couldn’t confirm that payment. If money was deducted, it will be sorted automatically.',
      );
    }
    const [row] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.profileId, profileId),
          eq(subscriptions.razorpaySubscriptionId, input.subscriptionId),
        ),
      );
    if (!row) throw AppError.notFound('Subscription');

    const fresh = await razorpay.getSubscription(input.subscriptionId);
    await db.update(subscriptions).set(fromRazorpay(fresh)).where(eq(subscriptions.id, row.id));
    await db
      .insert(subscriptionEvents)
      .values({
        eventId: `verify:${input.paymentId}`,
        type: 'checkout.verified',
        profileId,
        subscriptionId: row.id,
        razorpayPaymentId: input.paymentId,
        payload: { razorpay: fresh },
        processedAt: new Date(),
      })
      .onConflictDoNothing({ target: subscriptionEvents.eventId });
    return this.summary(profileId);
  },

  /**
   * Autopay off, no refund: access continues until the paid-through date, then it lapses.
   * An upcoming (not yet charged) subscription is cancelled outright.
   */
  async cancel(profileId: string) {
    const rows = await subscriptionsOf(profileId);
    const targets = rows.filter((s) => AUTOPAY_ON.includes(s.status) && s.autoRenew);
    if (!targets.length) throw new AppError(409, 'There’s no active autopay to turn off.');
    for (const s of targets) {
      const charged = s.paidCount > 0;
      const r = await razorpay.cancelSubscription(s.razorpaySubscriptionId, charged);
      await db
        .update(subscriptions)
        .set({
          ...fromRazorpay(r),
          // Keep the paid-through date we already have; cycle-end cancel doesn't change it.
          nextBillAt: s.nextBillAt,
          autoRenew: false,
          cancelledAt: new Date(),
        })
        .where(eq(subscriptions.id, s.id));
    }
    return this.summary(profileId);
  },

  /**
   * A verified webhook. Stored once per event id (retries are harmless); every charge moves the
   * paid-through date forward; failures, halts and cancels are recorded for the user.
   */
  async handleWebhook(eventId: string, body: WebhookBody) {
    const sub = body.payload?.subscription?.entity;
    const payment = body.payload?.payment?.entity;
    const [row] = sub
      ? await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.razorpaySubscriptionId, sub.id))
      : [];

    const [stored] = await db
      .insert(subscriptionEvents)
      .values({
        eventId,
        type: body.event,
        profileId: row?.profileId ?? null,
        subscriptionId: row?.id ?? null,
        razorpayPaymentId: payment?.id ?? null,
        amountPaise: payment?.amount ?? null,
        payload: body as unknown as Record<string, unknown>,
        error: sub && !row ? 'unknown subscription' : null,
      })
      .onConflictDoNothing({ target: subscriptionEvents.eventId })
      .returning({ id: subscriptionEvents.id });
    if (!stored) return { duplicate: true }; // already handled this exact event

    // Razorpay's paid count only goes up, so it orders events: an older one (a late retry)
    // is recorded but never rolls status, count or dates back.
    if (row && sub && sub.paid_count >= row.paidCount) {
      await db
        .update(subscriptions)
        .set({
          ...fromRazorpay(sub),
          nextBillAt: accessUntil(row, sub),
          ...(['cancelled', 'completed', 'expired'].includes(sub.status) && {
            autoRenew: false,
            cancelledAt: row.cancelledAt ?? new Date(),
          }),
        })
        .where(eq(subscriptions.id, row.id));
    }
    await db
      .update(subscriptionEvents)
      .set({ processedAt: new Date() })
      .where(eq(subscriptionEvents.id, stored.id));
    return { duplicate: false };
  },

  /** For profile screens: the latest payments (charges, failures) of this user. */
  async history(profileId: string) {
    return db
      .select({
        type: subscriptionEvents.type,
        amountPaise: subscriptionEvents.amountPaise,
        at: subscriptionEvents.receivedAt,
      })
      .from(subscriptionEvents)
      .where(
        and(
          eq(subscriptionEvents.profileId, profileId),
          inArray(subscriptionEvents.type, [
            'subscription.charged',
            'payment.failed',
            'checkout.verified',
          ]),
        ),
      )
      .orderBy(desc(subscriptionEvents.receivedAt))
      .limit(12);
  },
};

const laterOf = (a: Date | null, b: Date | null) => (!a ? b : !b ? a : a > b ? a : b);

/**
 * Paid-through date after an event. Charges only ever move it forward. A cancel normally keeps
 * it (autopay off, access until then), but an immediate cancel (e.g. from the Razorpay
 * dashboard) ends earlier: its `ended_at` is before our date, so access stops there.
 */
function accessUntil(row: Subscription, sub: RzpSubscription) {
  const paidThrough = laterOf(
    row.nextBillAt,
    sub.paid_count > 0 ? fromUnix(sub.current_end) : null,
  );
  const endedAt = fromUnix(sub.ended_at);
  const ended = ['cancelled', 'completed', 'expired'].includes(sub.status);
  return ended && endedAt && paidThrough && endedAt < paidThrough ? endedAt : paidThrough;
}

export interface WebhookBody {
  event: string;
  payload?: {
    subscription?: { entity: RzpSubscription };
    payment?: { entity: { id: string; amount: number; status: string } };
  };
}
