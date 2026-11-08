import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../../db';
import {
  activities,
  activityKindEnum,
  meals,
  type ActivityKind,
  type AgentAsk,
} from '../../db/schema';
import type { ImageUpload } from '../../validators/image.validator';
import { activeKcalAt, MAX_SLEEP_HOURS, MET, sleepKcal } from '../burn/burn.math';
import { burnService } from '../burn/burn.service';
import { challengeProgressService } from '../challenges/challenge-progress.service';
import { verifyProof } from '../challenges/proof.service';
import { exerciseService } from '../exercises/exercise.service';
import { mealService } from '../meals/meal.service';
import { planService } from '../plan/plan.service';
import type { AgentContext } from './agent.context';
import type { Proposal } from './agent.schema';

/** Logs need a photo the AI accepts, exactly like logging from the dashboard. */
export const NEEDS_PHOTO = new Set(['log_meal', 'log_activity', 'log_challenge', 'log_sleep']);

const LOGGABLE = new Set<string>(activityKindEnum.enumValues.filter((k) => k !== 'sleep'));

export type Prepared =
  { kind: string; payload: Record<string, unknown> } | { error: string; ask?: AgentAsk };

/** What the user may adjust on the card before confirming. */
export interface ConfirmInput {
  date: string;
  image?: ImageUpload;
  minutes?: number;
  calories?: number;
  amount?: number;
  hours?: number;
  items?: { name: string; portion: string; proteinG: number; carbsG: number; fatG: number }[];
}

export type Executed =
  { ok: true; summary: string; result: Record<string, unknown> } | { ok: false; note: string };

const round = (n: number) => Math.round(n * 100) / 100;

/** A client photo tool returns an estimate card, never a saved meal. */
export async function prepareMealPhoto(
  profileId: string,
  date: string,
  image: ImageUpload,
): Promise<Prepared> {
  const est = await mealService.analyze(profileId, { date, image });
  if (!est.isFood) return { error: est.comment };
  return {
    kind: 'log_meal',
    payload: {
      title: est.title,
      items: est.items,
      totals: est.totals,
      comment: est.comment,
      credits: est.credits,
      conflicts: est.conflicts,
    },
  };
}

/**
 * Turns the model's proposal into a card. Every number on it is computed here (meal macros from
 * the estimator, kcal from MET × weight × time), never taken from the model.
 */
export async function prepare(
  profileId: string,
  date: string,
  ctx: AgentContext,
  p: Proposal,
): Promise<Prepared> {
  const kg = ctx.prompt.user.weightKg ?? 70;

  switch (p.kind) {
    case 'log_meal': {
      if (!p.mealText.trim()) return { error: 'I need to know what you ate first.' };
      const est = await mealService.estimateText(profileId, date, p.mealText);
      if (!est.isFood) return { error: est.comment };
      return {
        kind: 'log_meal',
        payload: {
          title: est.title,
          items: est.items,
          totals: est.totals,
          comment: est.comment,
          credits: est.credits,
          conflicts: est.conflicts,
        },
      };
    }

    case 'log_activity': {
      let exercise: { id: string; name: string; met: number; kind: ActivityKind } | null = null;
      if (p.exerciseQuery.trim()) {
        const found = await exerciseService.list(profileId, date, {
          q: p.exerciseQuery,
          limit: 1,
          offset: 0,
        });
        const hit = found.items[0];
        if (hit) {
          const full = await exerciseService.get(profileId, date, hit.id);
          exercise = { id: full.id, name: full.name, met: full.met, kind: full.kind };
        }
      }
      const kind =
        exercise?.kind ?? (LOGGABLE.has(p.activity) ? (p.activity as ActivityKind) : null);
      if (!kind) return { error: 'Which activity was it?' };
      const minutes = p.minutes > 0 ? Math.min(600, Math.round(p.minutes)) : null;
      const calories = !minutes && p.calories > 0 ? Math.min(3000, Math.round(p.calories)) : null;
      if (!minutes && !calories) return { error: 'How long did you do it for?' };
      const met = exercise?.met ?? MET[kind];
      return {
        kind: 'log_activity',
        payload: {
          activity: exercise ? null : kind,
          exerciseId: exercise?.id ?? null,
          label: exercise?.name ?? kind.replace('_', ' '),
          met,
          minutes,
          calories,
          previewKcal: calories ?? activeKcalAt(met, minutes!, kg),
        },
      };
    }

    case 'log_challenge': {
      const c = ctx.raw.challenges.find((x) => x.id === p.challengeId);
      if (!c) return { error: 'I couldn’t find that challenge on your list.' };
      if (c.logsVia === 'meal') {
        return {
          error: 'Add a meal photo so you can review the food and update your challenge together.',
          ask: { kind: 'photo' },
        };
      }
      const amount =
        c.tracking.kind === 'check' ? 1 : round(p.amount > 0 ? p.amount : c.tracking.step);
      return {
        kind: 'log_challenge',
        payload: {
          challengeId: c.id,
          title: c.title,
          label: c.tracking.label ?? c.title,
          check: c.tracking.kind === 'check',
          unit: c.tracking.unit,
          step: c.tracking.step,
          amount,
          progress: c.progress,
          proof: c.tracking.proof,
          // Reuse the persisted dashboard widget; never ask the model to invent its layout.
          challenge: { ...c, progress: { ...c.progress, history: c.progress.history.slice(-7) } },
        },
      };
    }

    case 'log_sleep': {
      if (!(p.hours > 0)) return { error: 'How many hours did you sleep?' };
      const hours = Math.min(MAX_SLEEP_HOURS, round(p.hours));
      // With a sleep challenge, log through it: progress and burn move together.
      const challenge = ctx.raw.challenges.find(
        (c) => c.category === 'sleep' && /^(h|hrs?|hours?)$/i.test(c.tracking.unit ?? ''),
      );
      return {
        kind: 'log_sleep',
        payload: {
          hours,
          challengeId: challenge?.id ?? null,
          previewKcal: sleepKcal(hours * 60, kg),
        },
      };
    }

    case 'change_challenges': {
      const plan = ctx.prompt.planChallenges;
      const byId = new Map(plan.map((c) => [c.id, c]));
      const accept = p.acceptIds.map((id) => byId.get(id)).filter((c) => c && !c.accepted);
      const drop = p.dropIds.map((id) => byId.get(id)).filter((c) => c?.accepted);
      if (!accept.length && !drop.length)
        return { error: 'Your challenges already look like that.' };
      return {
        kind: 'change_challenges',
        payload: {
          accept: accept.map((c) => ({ id: c!.id, title: c!.title })),
          drop: drop.map((c) => ({ id: c!.id, title: c!.title })),
        },
      };
    }

    case 'remove_last': {
      if (p.removeTarget === 'meal') {
        const [m] = await db
          .select()
          .from(meals)
          .where(and(eq(meals.profileId, profileId), eq(meals.localDate, date)))
          .orderBy(desc(meals.createdAt))
          .limit(1);
        if (!m) return { error: 'There’s no meal logged today to remove.' };
        return {
          kind: 'remove_last',
          payload: { target: 'meal', id: m.id, title: m.title, calories: m.calories },
        };
      }
      if (p.removeTarget === 'activity') {
        const [a] = await db
          .select()
          .from(activities)
          .where(
            and(
              eq(activities.profileId, profileId),
              eq(activities.localDate, date),
              isNull(activities.challengeLogId), // challenge-made entries belong to the challenge
            ),
          )
          .orderBy(desc(activities.createdAt))
          .limit(1);
        if (!a) return { error: 'There’s no activity logged today to remove.' };
        return {
          kind: 'remove_last',
          payload: {
            target: 'activity',
            id: a.id,
            title: a.exerciseName ?? a.kind,
            calories: a.calories,
          },
        };
      }
      return { error: 'Remove the last meal or the last activity?' };
    }

    default:
      return { error: 'I can’t do that one yet.' };
  }
}

/** Runs a confirmed card through the same services as the rest of the app. */
export async function execute(
  profileId: string,
  kind: string,
  payload: Record<string, unknown>,
  input: ConfirmInput,
): Promise<Executed> {
  const { date, image } = input;
  if (NEEDS_PHOTO.has(kind) && !image)
    return { ok: false, note: 'Add a photo first, then confirm.' };

  switch (kind) {
    case 'log_meal': {
      const items = input.items ?? (payload.items as ConfirmInput['items'])!;
      const title = payload.title as string;
      // The photo has to show food, like every other proof in the app.
      const verdict = await verifyProof(
        { title: `Meal: ${title}`, target: '1 meal', frequency: 'daily' },
        {
          kind: 'check',
          unit: null,
          target: 1,
          step: 1,
          widget: 'check',
          proof: 'the food or the plate',
        },
        image!,
      );
      if (!verdict.verified) return { ok: false, note: verdict.note };
      // Only conflicts still on the plate count: removing the off-diet food in the card lifts
      // the block, same as the meal sheet. save() re-checks the final items by name too.
      const kept = new Set(items.map((i) => i.name.toLowerCase()));
      const conflicts = ((payload.conflicts as { item: string }[]) ?? []).filter((c) =>
        kept.has(c.item.toLowerCase()),
      );
      const saved = await mealService.save(
        profileId,
        {
          date,
          title,
          items,
          comment: payload.comment as string,
          credits: conflicts.length
            ? []
            : ((payload.credits as { challengeId: string; amount: number }[]) ?? []),
        },
        { bytes: Buffer.from(image!.base64, 'base64'), mimeType: image!.mimeType },
      );
      return {
        ok: true,
        summary: `Logged ${title} · +${saved.meal.calories} kcal`,
        result: { kcal: saved.meal.calories, credits: saved.credits.map((c) => c.label) },
      };
    }

    case 'log_activity': {
      const minutes = input.minutes ?? (payload.minutes as number | null) ?? undefined;
      const calories = minutes
        ? undefined
        : (input.calories ?? (payload.calories as number | null) ?? undefined);
      const r = await burnService.log(profileId, {
        date,
        ...(payload.exerciseId
          ? { exerciseId: payload.exerciseId as string }
          : { kind: payload.activity as Exclude<ActivityKind, 'sleep'> }),
        ...(minutes ? { minutes } : { calories }),
        image: image!,
      });
      if (!r.verified) return { ok: false, note: r.note };
      return {
        ok: true,
        summary: `Logged ${r.activity.label} · ${r.activity.calories} kcal burned`,
        result: { kcal: r.activity.calories },
      };
    }

    case 'log_challenge': {
      const amount = input.amount ?? (payload.amount as number);
      const r = await challengeProgressService.log(
        profileId,
        payload.challengeId as string,
        date,
        image!,
        payload.check ? undefined : amount,
      );
      if (!r.verified) return { ok: false, note: r.note };
      const unit = payload.check ? '' : ` ${(payload.unit as string | null) ?? ''}`.trimEnd();
      return {
        ok: true,
        summary: payload.check
          ? `${payload.label as string} done for today`
          : `${payload.label as string} +${r.amount}${unit}`,
        result: { amount: r.amount },
      };
    }

    case 'log_sleep': {
      const hours = input.hours ?? (payload.hours as number);
      if (payload.challengeId) {
        const r = await challengeProgressService.log(
          profileId,
          payload.challengeId as string,
          date,
          image!,
          hours,
        );
        if (!r.verified) return { ok: false, note: r.note };
        return { ok: true, summary: `Logged ${hours} h of sleep`, result: { hours } };
      }
      const r = await burnService.logSleep(profileId, { date, hours, image: image! });
      if (!r.verified) return { ok: false, note: r.note };
      return {
        ok: true,
        summary: `Logged ${hours} h of sleep · ${r.activity.calories} kcal`,
        result: { hours },
      };
    }

    case 'change_challenges': {
      const plan = await planService.get(profileId);
      const current = new Set(plan.challenges.filter((c) => c.accepted).map((c) => c.id));
      for (const c of payload.drop as { id: string }[]) current.delete(c.id);
      for (const c of payload.accept as { id: string }[]) current.add(c.id);
      await planService.setAcceptedChallenges(profileId, [...current]);
      return { ok: true, summary: 'Challenges updated', result: { accepted: current.size } };
    }

    case 'remove_last': {
      if (payload.target === 'meal') await mealService.remove(profileId, payload.id as string);
      else await burnService.remove(profileId, payload.id as string);
      return { ok: true, summary: `Removed ${payload.title as string}`, result: {} };
    }

    default:
      return { ok: false, note: 'That action isn’t supported.' };
  }
}
