import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../../db';
import {
  challengeLogs,
  challenges,
  goals,
  type Challenge,
  type ChallengeTracking,
  profiles,
} from '../../db/schema';
import { AppError } from '../../utils/app-error';
import { looksLikeImage } from '../../validators/image.validator';
import { isFoodChallenge } from '../meals/food-challenge';
import { addDays, lastNDays, weekStart } from '../../utils/dates';
import type { LogProgressInput } from '../../validators/challenge.validator';
import { burnService } from '../burn/burn.service';
import { COMPANION_NAME, companionMood } from '../companion/companion.rules';
import { profileService } from '../profile.service';
import { mealService } from '../meals/meal.service';
import { verifyProof } from './proof.service';
import { ensureTracking } from './tracking.service';

/** Longest streak we look back for (keeps the query bounded). */
const STREAK_LOOKBACK_DAYS = 60;

type DailyTotals = Map<string, number>; // 'YYYY-MM-DD' → amount

/** Per-day totals for all of a profile's challenges in ONE grouped query (not one per challenge). */
async function dailyTotalsByChallenge(
  profileId: string,
  from: string,
  to: string,
): Promise<Map<string, DailyTotals>> {
  const rows = await db
    .select({
      challengeId: challengeLogs.challengeId,
      day: challengeLogs.localDate,
      total: sql<number>`sum(${challengeLogs.amount})::float`,
    })
    .from(challengeLogs)
    .where(
      and(
        eq(challengeLogs.profileId, profileId),
        gte(challengeLogs.localDate, from),
        lte(challengeLogs.localDate, to),
      ),
    )
    .groupBy(challengeLogs.challengeId, challengeLogs.localDate);

  const byChallenge = new Map<string, DailyTotals>();
  for (const r of rows) {
    const totals = byChallenge.get(r.challengeId) ?? new Map();
    totals.set(r.day, Number(r.total));
    byChallenge.set(r.challengeId, totals);
  }
  return byChallenge;
}

/** Days of history returned per challenge (a 4-week timeline). */
const HISTORY_DAYS = 28;

/** Consecutive days (ending today, or yesterday if today isn't done yet) that hit the daily target. */
function dailyStreak(
  totals: DailyTotals,
  today: string,
  target: number,
  startedOn: string,
): number {
  const hit = (d: string) => d >= startedOn && (totals.get(d) ?? 0) >= target;
  let day = hit(today) ? today : addDays(today, -1);
  let streak = 0;
  while (hit(day) && streak < STREAK_LOOKBACK_DAYS) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

/**
 * Progress for one challenge. History is a 4-week timeline where each day is either
 * inactive (before the user took the challenge on) or active with its total, so a missed
 * day is honestly "active and below target", never a day the challenge didn't exist.
 */
function progressView(
  frequency: 'daily' | 'weekly',
  tracking: ChallengeTracking,
  totals: DailyTotals,
  today: string,
  startedOn: string,
) {
  const value =
    frequency === 'daily'
      ? (totals.get(today) ?? 0)
      : [...totals.entries()]
          .filter(([d]) => d >= weekStart(today) && d <= today)
          .reduce((sum, [, v]) => sum + v, 0);
  const history = lastNDays(today, HISTORY_DAYS).map((date) => ({
    date,
    value: totals.get(date) ?? 0,
    active: date >= startedOn,
  }));
  // A daily challenge misses on a past active day below target (today isn't over yet).
  const missed =
    frequency === 'daily'
      ? history.filter((h) => h.active && h.date < today && h.value < tracking.target).length
      : 0;
  return {
    value: Math.round(value * 100) / 100,
    goal: tracking.target,
    done: value >= tracking.target,
    startedOn,
    history,
    streak: frequency === 'daily' ? dailyStreak(totals, today, tracking.target, startedOn) : 0,
    missed,
  };
}

/** The user's local calendar day for an instant, given their UTC offset in minutes. */
function localDay(instant: Date, tzOffsetMinutes: number): string {
  return new Date(instant.getTime() + tzOffsetMinutes * 60_000).toISOString().slice(0, 10);
}

/**
 * Proof for a food challenge, handled as a meal: the AI reads the plate, the meal is saved with
 * its calories, and this challenge is credited (plus any other food challenge the meal fits).
 */
async function logAsMeal(
  profileId: string,
  challenge: Challenge & { tracking: ChallengeTracking },
  date: string,
  image: LogProgressInput['image'],
) {
  const bytes = Buffer.from(image.base64, 'base64');
  if (!looksLikeImage(bytes, image.mimeType))
    throw new AppError(400, 'That file is not a valid image');

  const analysis = await mealService.analyze(profileId, { date, image, challengeId: challenge.id });
  if (!analysis.isFood) return { verified: false as const, note: analysis.comment };
  // Proof for a challenge must fit the plan; off-diet food can still be logged from "Log meal".
  if (analysis.dietWarning) {
    return {
      verified: false as const,
      note: `${analysis.dietWarning} Use Log meal to still count its calories.`,
    };
  }

  // The user tapped this challenge and the photo is food, so it counts even if the AI skipped it.
  const step = challenge.tracking.kind === 'check' ? 1 : challenge.tracking.step;
  const credits = analysis.credits.some((c) => c.challengeId === challenge.id)
    ? analysis.credits
    : [...analysis.credits, { challengeId: challenge.id, amount: step }];

  const { meal, credits: saved } = await mealService.save(
    profileId,
    { date, title: analysis.title, items: analysis.items, comment: analysis.comment, credits },
    { bytes, mimeType: image.mimeType },
  );
  const own = saved.find((c) => c.challengeId === challenge.id);
  return {
    verified: true as const,
    note: analysis.comment,
    amount: own?.amount ?? step,
    meal: { calories: meal.calories },
  };
}

/** Total already logged this period (today, or this week for weekly challenges). */
async function periodTotal(challenge: Challenge, date: string) {
  const from = challenge.frequency === 'weekly' ? weekStart(date) : date;
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${challengeLogs.amount}), 0)::float` })
    .from(challengeLogs)
    .where(
      and(
        eq(challengeLogs.challengeId, challenge.id),
        gte(challengeLogs.localDate, from),
        lte(challengeLogs.localDate, date),
      ),
    );
  return Number(row?.total ?? 0);
}

/**
 * What one log adds: 1 for done/not-done, else the user's amount (default one step), capped at
 * what's left of the goal so a photo can finish a challenge but never overflow it.
 */
function loggedAmount(t: ChallengeTracking, requested: number | undefined, soFar: number) {
  if (t.kind === 'check') return 1;
  const left = Math.max(0, t.target - soFar);
  const amount = Math.min(requested ?? t.step, left || t.step);
  return Math.round(amount * 100) / 100;
}

/**
 * The companion cat on the dashboard: undecided / declined (no mood), or her mood from the
 * challenge history. When the rules say she's left, that's saved once and sticks until re-adoption.
 */
async function companionView(
  profileId: string,
  today: string,
  tz: number,
  items: {
    frequency: string;
    progress: { goal: number; history: { date: string; value: number; active: boolean }[] };
  }[],
) {
  const [row] = await db
    .select({ preferences: profiles.preferences })
    .from(profiles)
    .where(eq(profiles.id, profileId));
  const prefs = row?.preferences.companion;
  const base = { name: COMPANION_NAME, introSeen: prefs?.introSeen ?? false };

  if (!prefs?.status) return { ...base, status: 'undecided' as const, mood: null, line: null };
  if (prefs.status === 'declined')
    return { ...base, status: 'declined' as const, mood: null, line: null };
  if (prefs.status === 'left') {
    return {
      ...base,
      status: 'left' as const,
      mood: 'left' as const,
      line: `${COMPANION_NAME} left. Adopt her again?`,
    };
  }

  const view = companionMood({
    today,
    adoptedOn: prefs.adoptedAt ? localDay(new Date(prefs.adoptedAt), tz) : today,
    daily: items
      .filter((c) => c.frequency === 'daily')
      .map((c) => ({ goal: c.progress.goal, history: c.progress.history })),
    acceptedCount: items.length,
  });
  if (view.mood === 'left') {
    await profileService.companionLeft(profileId);
    return { ...base, status: 'left' as const, ...view };
  }
  return { ...base, status: 'adopted' as const, ...view };
}

export const challengeProgressService = {
  /** Everything the dashboard needs for `today` (the user's local date). */
  async today(profileId: string, today: string, tzOffsetMinutes = 0) {
    const from = addDays(today, -STREAK_LOOKBACK_DAYS);
    // Independent reads run in parallel: 3 round-trips to the database become 1.
    const [goal, accepted, totals, day, burn] = await Promise.all([
      db.query.goals.findFirst({ where: eq(goals.profileId, profileId) }),
      db
        .select()
        .from(challenges)
        .where(and(eq(challenges.profileId, profileId), eq(challenges.accepted, true)))
        .orderBy(asc(challenges.createdAt), asc(challenges.id)),
      dailyTotalsByChallenge(profileId, from, today),
      mealService.forDay(profileId, today),
      burnService.forDay(profileId, today),
    ]);
    const tracked = await ensureTracking(accepted); // no-op once specs are stored

    const items = tracked.map((c) => ({
      id: c.id,
      title: c.title,
      target: c.target,
      why: c.why,
      frequency: c.frequency,
      category: c.category,
      tracking: c.tracking,
      // The server decides, so every client logs food the same way (and calories stay in sync).
      logsVia: isFoodChallenge(c) ? ('meal' as const) : ('proof' as const),
      progress: progressView(
        c.frequency,
        c.tracking,
        totals.get(c.id) ?? new Map(),
        today,
        // Older rows (before acceptedAt existed) start today: no invented misses.
        c.acceptedAt ? localDay(c.acceptedAt, tzOffsetMinutes) : today,
      ),
    }));

    const companion = await companionView(profileId, today, tzOffsetMinutes, items);

    return {
      date: today,
      companion,
      targets: goal
        ? {
            calories: goal.dailyCalories,
            proteinG: goal.proteinG,
            carbsG: goal.carbsG,
            fatG: goal.fatG,
          }
        : null,
      eaten: day.eaten,
      meals: day.meals,
      burn,
      challenges: items,
    };
  },

  /**
   * One tap of progress, accepted only with photo proof the AI verifies.
   * Rejected proof is not an error for the client: it gets the verdict and can retry.
   */
  async log(
    profileId: string,
    challengeId: string,
    date: string,
    image: LogProgressInput['image'],
    requested?: number,
  ) {
    const [challenge] = await db
      .select()
      .from(challenges)
      .where(and(eq(challenges.id, challengeId), eq(challenges.profileId, profileId)))
      .limit(1);
    if (!challenge || !challenge.accepted) throw AppError.notFound('Challenge');
    const [[tracked], soFar] = await Promise.all([
      ensureTracking([challenge]),
      periodTotal(challenge, date),
    ]);

    // A food photo is a meal: log it as one, so the calorie ring moves with the challenge.
    if (isFoodChallenge(challenge)) return logAsMeal(profileId, tracked!, date, image);

    let verdict;
    try {
      verdict = await verifyProof(
        challenge,
        tracked!.tracking,
        image,
        loggedAmount(tracked!.tracking, requested, soFar),
      );
    } catch {
      throw new AppError(502, 'We couldn’t check your photo right now. Please try again.');
    }
    if (!verdict.verified) return { verified: false as const, note: verdict.note };

    const amount = loggedAmount(tracked!.tracking, requested, soFar);
    // The log and its burn land together: a walk or a night's sleep moves both at once.
    const burned = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(challengeLogs)
        .values({ challengeId, profileId, localDate: date, amount, proofNote: verdict.note })
        .returning({ id: challengeLogs.id });
      return burnService.fromChallengeLog(tx, {
        profileId,
        challenge,
        tracking: tracked!.tracking,
        // What they actually did (8 h of sleep), even if the goal caps progress at 7.5.
        amount: requested ?? amount,
        date,
        challengeLogId: row!.id,
      });
    });
    return { verified: true as const, note: verdict.note, amount, burned };
  },
};
