import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env';
import { AppError } from '../../utils/app-error';
import { fetchWithTimeout } from '../ai/llm-provider';

/** Thin REST wrapper over the few Razorpay endpoints we use (no SDK: fewer moving parts). */

const BASE = 'https://api.razorpay.com/v1';
const TIMEOUT_MS = 15_000;

export function razorpayConfigured() {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

function credentials() {
  if (!razorpayConfigured()) {
    throw new AppError(503, 'Payments aren’t set up yet. Please try again later.');
  }
  return Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const res = await fetchWithTimeout(
    `${BASE}${path}`,
    {
      method,
      headers: {
        Authorization: `Basic ${credentials()}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    },
    TIMEOUT_MS,
  );
  const data = (await res.json().catch(() => null)) as
    (T & { error?: { description?: string } }) | null;
  if (!res.ok) {
    console.warn('[razorpay]', method, path, res.status, data?.error?.description);
    throw new AppError(502, 'The payment service didn’t respond as expected. Please try again.');
  }
  return data as T;
}

export interface RzpPlan {
  id: string;
}

/** Fields we read from a Razorpay subscription (unix seconds for times). */
export interface RzpSubscription {
  id: string;
  status: string;
  plan_id: string;
  start_at: number | null;
  current_start: number | null;
  current_end: number | null;
  end_at: number | null;
  charge_at: number | null;
  paid_count: number;
  /** Set when the subscription actually ended (an immediate cancel: now; at cycle end: then). */
  ended_at?: number | null;
  notes?: Record<string, string>;
}

export const razorpay = {
  createPlan(input: { name: string; amountPaise: number; period: string; interval: number }) {
    return call<RzpPlan>('POST', '/plans', {
      period: input.period,
      interval: input.interval,
      item: { name: input.name, amount: input.amountPaise, currency: 'INR' },
    });
  },

  createSubscription(input: {
    planId: string;
    totalCount: number;
    startAt?: number;
    notes: Record<string, string>;
  }) {
    return call<RzpSubscription>('POST', '/subscriptions', {
      plan_id: input.planId,
      total_count: input.totalCount,
      quantity: 1,
      customer_notify: 0,
      ...(input.startAt && { start_at: input.startAt }),
      notes: input.notes,
    });
  },

  getSubscription(id: string) {
    return call<RzpSubscription>('GET', `/subscriptions/${id}`);
  },

  /** atCycleEnd: autopay off, access until the paid-through date (no refund). */
  cancelSubscription(id: string, atCycleEnd: boolean) {
    return call<RzpSubscription>('POST', `/subscriptions/${id}/cancel`, {
      cancel_at_cycle_end: atCycleEnd ? 1 : 0,
    });
  },
};

const sameHmac = (expected: string, given: string) => {
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
};

/** Checkout success: HMAC(payment_id|subscription_id) with the key secret. */
export function validCheckoutSignature(
  paymentId: string,
  subscriptionId: string,
  signature: string,
) {
  if (!env.RAZORPAY_KEY_SECRET) return false;
  const expected = createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${paymentId}|${subscriptionId}`)
    .digest('hex');
  return sameHmac(expected, signature);
}

/** Webhooks: HMAC of the exact raw body with the webhook secret. */
export function validWebhookSignature(rawBody: Buffer, signature: string) {
  if (!env.RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  return sameHmac(expected, signature);
}
