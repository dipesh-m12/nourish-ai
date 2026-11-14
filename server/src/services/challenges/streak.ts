import { addDays } from '../../utils/dates';

/** At most one rest day in any 7 days of a streak. */
export const REST_EVERY_DAYS = 7;

/**
 * Consecutive days that hit the daily target, ending today (or yesterday if today isn't done
 * yet). Pure.
 *
 * A habit survives one missed day, so a streak should too: one isolated miss per 7 days is a
 * rest day. It doesn't count, and it doesn't break the run. Two misses in a row, or a second miss
 * within the week, still end it.
 */
export function dailyStreak(
  hit: (day: string) => boolean,
  today: string,
  startedOn: string,
  maxDays = 60,
): number {
  const done = (d: string) => d >= startedOn && hit(d);
  let day = done(today) ? today : addDays(today, -1);
  let streak = 0;
  let lastRest: string | null = null;
  for (let n = 0; n < maxDays && day >= startedOn; n++) {
    if (done(day)) {
      streak++;
    } else {
      // Forgive it only between two done days, and only once per week of the run.
      const restOk =
        done(addDays(day, -1)) && (lastRest === null || addDays(day, REST_EVERY_DAYS) <= lastRest);
      if (!restOk) break;
      lastRest = day;
    }
    day = addDays(day, -1);
  }
  return streak;
}
