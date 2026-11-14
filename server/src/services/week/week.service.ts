import { and, eq, gte, lte, ne, sql } from 'drizzle-orm';
import { db } from '../../db';
import { activities, goals, meals, profiles } from '../../db/schema';
import { AppError } from '../../utils/app-error';
import { addDays, lastNDays } from '../../utils/dates';
import { challengeProgressService } from '../challenges/challenge-progress.service';
import { buildWeek, type WeekTotals } from './week.rules';

type Day = { kcal: number; protein: number; activeMin: number; sleepMin: number };

/** Folds 7 days of per-day numbers (+ challenge histories) into one week's totals. */
function totals(
  days: string[],
  byDay: Map<string, Day>,
  challenges: Awaited<ReturnType<typeof challengeProgressService.today>>['challenges'],
): WeekTotals {
  let activeDays = 0;
  let fullDays = 0;
  const daily = challenges.filter((c) => c.frequency === 'daily');
  for (const date of days) {
    // Each running challenge that day, paired with its own goal.
    const running = daily.flatMap((c) => {
      const h = c.progress.history.find((x) => x.date === date);
      return h?.active ? [{ value: h.value, goal: c.progress.goal }] : [];
    });
    if (!running.length) continue;
    activeDays++;
    if (running.every((r) => r.value >= r.goal)) fullDays++;
  }
  const logged = days.map((d) => byDay.get(d)).filter((d): d is Day => Boolean(d && d.kcal > 0));
  const slept = days.map((d) => byDay.get(d)).filter((d): d is Day => Boolean(d && d.sleepMin > 0));
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return {
    activeDays,
    fullDays,
    loggedDays: logged.length,
    avgKcal: avg(logged.map((d) => d.kcal)),
    avgProteinG: avg(logged.map((d) => d.protein)),
    activeMinutes: days.reduce((s, d) => s + (byDay.get(d)?.activeMin ?? 0), 0),
    sleepNights: slept.length,
    avgSleepH: avg(slept.map((d) => d.sleepMin / 60)),
  };
}

export const weekService = {
  /** This week (the 7 days ending today) against the 7 before, for the check-in screen. */
  async review(profileId: string, date: string, tz: number) {
    const from = addDays(date, -13);
    const [profile, goal, mealRows, activityRows, today] = await Promise.all([
      db.query.profiles.findFirst({ where: eq(profiles.id, profileId), columns: { name: true } }),
      db.query.goals.findFirst({ where: eq(goals.profileId, profileId) }),
      db
        .select({
          day: meals.localDate,
          kcal: sql<number>`sum(${meals.calories})::int`,
          protein: sql<number>`sum(${meals.proteinG})::int`,
        })
        .from(meals)
        .where(
          and(
            eq(meals.profileId, profileId),
            gte(meals.localDate, from),
            lte(meals.localDate, date),
          ),
        )
        .groupBy(meals.localDate),
      db
        .select({
          day: activities.localDate,
          active: sql<number>`coalesce(sum(${activities.minutes}) filter (where ${activities.kind} <> 'sleep'), 0)::int`,
          sleep: sql<number>`coalesce(sum(${activities.minutes}) filter (where ${activities.kind} = 'sleep'), 0)::int`,
        })
        .from(activities)
        .where(
          and(
            eq(activities.profileId, profileId),
            gte(activities.localDate, from),
            lte(activities.localDate, date),
            ne(activities.minutes, 0),
          ),
        )
        .groupBy(activities.localDate),
      challengeProgressService.today(profileId, date, tz),
    ]);
    if (!profile || !goal) throw AppError.notFound('Profile');

    const byDay = new Map<string, Day>();
    const day = (d: string) => {
      if (!byDay.has(d)) byDay.set(d, { kcal: 0, protein: 0, activeMin: 0, sleepMin: 0 });
      return byDay.get(d)!;
    };
    for (const m of mealRows) Object.assign(day(m.day), { kcal: m.kcal, protein: m.protein });
    for (const a of activityRows)
      Object.assign(day(a.day), { activeMin: a.active, sleepMin: a.sleep });

    const thisDays = lastNDays(date, 7);
    const lastDays = lastNDays(addDays(date, -7), 7);
    const habits = today.challenges
      .filter((c) => c.frequency === 'daily')
      .map((c) => {
        const week = c.progress.history.filter((h) => thisDays.includes(h.date) && h.active);
        return {
          label: c.tracking.label ?? c.title,
          done: week.filter((h) => h.value >= c.progress.goal).length,
          active: week.length,
        };
      });

    return buildWeek({
      name: profile.name,
      targets: { calories: goal.dailyCalories, proteinG: goal.proteinG },
      thisWeek: totals(thisDays, byDay, today.challenges),
      lastWeek: totals(lastDays, byDay, today.challenges),
      habits,
    });
  },
};
