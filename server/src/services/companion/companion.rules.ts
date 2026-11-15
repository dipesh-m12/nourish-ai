import { addDays } from '../../utils/dates';
import { REST_EVERY_DAYS } from '../challenges/streak';

/**
 * The companion cat's mood, from the user's challenge history. Pure, so every rule is testable.
 *
 * A day is "perfect" when every daily challenge active that day was done. Any other day after
 * adoption counts as missed, including a day with no challenges at all (so dropping every
 * challenge can't keep her around). Three missed days in a row and she leaves.
 */

export const COMPANION_NAME = 'Mochi';
export const DAYS_UNTIL_SHE_LEAVES = 3;

export type Mood = 'happy' | 'normal' | 'sad' | 'left';

export interface DailyHistory {
  goal: number;
  /** Oldest first, one entry per day, ending today (`goal` = that day's goal). */
  history: { date: string; value: number; active: boolean; goal?: number }[];
}

export interface MoodInput {
  today: string;
  /** Local date she was adopted (days before it never count against the user). */
  adoptedOn: string;
  /** Accepted daily challenges with their history. */
  daily: DailyHistory[];
  /** Accepted challenges of any frequency (0 → she's bored). */
  acceptedCount: number;
}

export interface MoodView {
  mood: Mood;
  /** One short line under her on the dashboard. */
  line: string;
}

/** Was this past day perfect? (No active challenges that day = not perfect.) */
function perfect(daily: DailyHistory[], day: string) {
  const active = daily
    .map((c) => ({ c, h: c.history.find((x) => x.date === day) }))
    .filter((x) => x.h?.active);
  return active.length > 0 && active.every((x) => x.h!.value >= (x.h!.goal ?? x.c.goal));
}

/** Did any daily challenge run that day? (Days before the first one don't count as misses.) */
function hadAny(daily: DailyHistory[], day: string) {
  return daily.some((c) => c.history.find((x) => x.date === day)?.active);
}

export function companionMood(i: MoodInput): MoodView {
  const missed = (day: string) => day >= i.adoptedOn && !perfect(i.daily, day);

  // 1. Three missed days in a row (all after adoption): she leaves.
  const lastDays = Array.from({ length: DAYS_UNTIL_SHE_LEAVES }, (_, n) =>
    addDays(i.today, -(n + 1)),
  );
  if (lastDays.every(missed)) {
    return { mood: 'left', line: `${COMPANION_NAME} left. Adopt her again?` };
  }

  const todays = i.daily.map((c) => c.history.at(-1)).filter((h) => h?.active);
  const doneToday = i.daily.filter((c) => {
    const h = c.history.at(-1);
    return h?.active && h.value >= (h.goal ?? c.goal);
  }).length;
  const total = todays.length;

  // 2. Everything done today: purring (this also makes up for yesterday).
  if (total > 0 && doneToday === total) {
    return { mood: 'happy', line: `${COMPANION_NAME} is purring. All done!` };
  }
  // 3. Nothing taken on at all.
  if (i.acceptedCount === 0) {
    return { mood: 'normal', line: `${COMPANION_NAME} is bored. Take a challenge.` };
  }
  // 4. Missed yesterday. If it's the week's only miss, streaks hold (a rest day, see
  //    challenges/streak.ts) and she says so: forgiving once keeps people going.
  if (missed(addDays(i.today, -1))) {
    const week = Array.from({ length: REST_EVERY_DAYS - 1 }, (_, n) => addDays(i.today, -(n + 2)));
    const restDay =
      perfect(i.daily, week[0]!) && week.every((d) => perfect(i.daily, d) || !hadAny(i.daily, d));
    return {
      mood: 'sad',
      line: restDay
        ? `You missed yesterday. ${COMPANION_NAME} kept your streak, just this once.`
        : `You missed yesterday. ${COMPANION_NAME} cried.`,
    };
  }
  // 5. Halfway there.
  if (total > 0 && doneToday / total >= 0.5) {
    return { mood: 'happy', line: `${COMPANION_NAME} is happy. Keep going.` };
  }
  // 6. Waiting.
  const left = total - doneToday;
  return {
    mood: 'normal',
    line:
      left > 0 ? `${left} to go. ${COMPANION_NAME} is waiting.` : `${COMPANION_NAME} is waiting.`,
  };
}
