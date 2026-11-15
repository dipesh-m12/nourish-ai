import type { ChallengeTracking } from '../../db/schema';
import { addDays } from '../../utils/dates';

/**
 * Goals that follow progress: a habit hit every day for a week can step up ("20 → 25 min"),
 * one that keeps slipping can step down. Pure: the new number comes from the challenge's own
 * step (the numbers rule), never from the AI.
 *
 * A change starts tomorrow. Today, and every day before, keep the goal they were logged
 * against, so a level-up never turns a finished day red or breaks a streak.
 */

/** Plenty is plenty: a level-up stops here (per unit), or at twice the first goal. */
const CAPS: Record<string, number> = { min: 90, mins: 90, minutes: 90, steps: 15000, km: 15 };
/** More water or sleep isn't "better": those follow the body, not a ladder. */
const FIXED_CATEGORIES = new Set(['hydration', 'sleep']);
/** One change a week at most: a new goal needs a few days to settle. */
const SETTLE_DAYS = 7;

const round = (n: number) => Math.round(n * 100) / 100;

/** The goal that applied on a given day. */
export function goalOn(t: ChallengeTracking, day: string): number {
  for (const c of t.levels ?? []) if (day <= c.until) return c.target;
  return t.target;
}

/** The next goal up or down, or null when this challenge doesn't move (a check, water, sleep, a cap). */
export function nextTarget(
  t: ChallengeTracking,
  category: string,
  direction: 'up' | 'down',
): number | null {
  if (t.kind !== 'amount' || FIXED_CATEGORIES.has(category)) return null;
  const step = t.step > 0 ? t.step : 1;
  if (direction === 'down') {
    const next = round(t.target - step);
    return next >= step ? next : null;
  }
  const first = t.levels?.[0]?.target ?? t.target;
  const cap = CAPS[(t.unit ?? '').toLowerCase()] ?? first * 2;
  const next = round(t.target + step);
  return next <= cap ? next : null;
}

/** Changed in the last week? Then don't offer another change yet. */
export function changedRecently(t: ChallengeTracking, today: string): boolean {
  const last = t.levels?.at(-1);
  return Boolean(last && last.until >= addDays(today, -SETTLE_DAYS));
}

/** The tracking with a new goal from tomorrow. A second change the same day just replaces it. */
export function withTarget(t: ChallengeTracking, next: number, today: string): ChallengeTracking {
  const levels = t.levels ?? [];
  if (levels.at(-1)?.until === today) return { ...t, target: next };
  return { ...t, target: next, levels: [...levels, { until: today, target: t.target }] };
}

/**
 * The step up the PA may offer for a daily challenge: hit for a week in a row, nothing changed
 * lately, and there's room to grow.
 */
export function levelUpFor(
  c: { frequency: string; category: string; tracking: ChallengeTracking },
  streak: number,
  today: string,
): number | null {
  if (c.frequency !== 'daily' || streak < SETTLE_DAYS || changedRecently(c.tracking, today))
    return null;
  return nextTarget(c.tracking, c.category, 'up');
}
