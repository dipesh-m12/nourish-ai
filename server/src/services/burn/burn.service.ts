import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { db } from '../../db';
import {
  activities,
  challengeLogs,
  challenges,
  profiles,
  type Activity,
  type ActivityKind,
  type Challenge,
  type ChallengeTracking,
} from '../../db/schema';
import { AppError } from '../../utils/app-error';
import { addDays, lastNDays } from '../../utils/dates';
import type { LogActivityInput } from '../../validators/activity.validator';
import { bmr } from '../nutrition.service';
import { activeChallenges } from '../challenges/active';
import { ensureTracking } from '../challenges/tracking.service';
import { exerciseService } from '../exercises/exercise.service';
import {
  activeKcal,
  activeKcalAt,
  activityFromChallenge,
  challengeAmountFromActivity,
  dayBurn,
  MAX_SLEEP_HOURS,
  MET,
  sleepKcal,
} from './burn.math';

/** Anything DB-shaped that can insert (the db itself or a transaction). */
type Writer = Pick<typeof db, 'insert'>;

const LABELS: Record<ActivityKind, string> = {
  walk: 'Walk',
  brisk_walk: 'Brisk walk',
  run: 'Run',
  cycle: 'Cycling',
  yoga: 'Yoga',
  stretch: 'Stretching',
  strength: 'Strength',
  dance: 'Dance',
  sport: 'Sport',
  swim: 'Swim',
  chores: 'Chores',
  cardio: 'Cardio',
  plyometrics: 'Plyometrics',
  sleep: 'Sleep',
};

function toView(a: Activity) {
  return {
    id: a.id,
    kind: a.kind,
    label: a.exerciseName ?? LABELS[a.kind],
    minutes: Math.round(a.minutes),
    calories: a.calories,
    /** Challenge-made entries are removed with their challenge log, not on their own. */
    // Made by a challenge log (removed from that side); 'logged' ones were logged here.
    fromChallenge: a.challengeLogId !== null && a.source !== 'logged',
    /** A tracked walk: the app opens its trophy card from here. */
    sessionId: a.sessionId,
    createdAt: a.createdAt,
  };
}

async function bodyOf(profileId: string) {
  const p = await db.query.profiles.findFirst({ where: eq(profiles.id, profileId) });
  if (!p?.sex || !p.age || !p.heightCm || !p.weightKg) return null;
  return {
    kg: p.weightKg,
    /** First day the account existed: no body burn is counted before it. */
    since: p.createdAt.toISOString().slice(0, 10),
    bmr: bmr({
      sex: p.sex,
      age: p.age,
      heightCm: p.heightCm,
      weightKg: p.weightKg,
      activityLevel: p.activityLevel ?? 'sedentary',
    }),
  };
}

export const burnService = {
  /** Today's burn split (resting / sleep / active), the last 7 days' total burn, and the log. */
  async forDay(profileId: string, date: string) {
    const from = addDays(date, -6);
    const [body, rows] = await Promise.all([
      bodyOf(profileId),
      db
        .select()
        .from(activities)
        .where(
          and(
            eq(activities.profileId, profileId),
            gte(activities.localDate, from),
            lte(activities.localDate, date),
          ),
        )
        .orderBy(asc(activities.createdAt)),
    ]);

    const todays = rows.filter((a) => a.localDate === date);
    const sleep = todays.filter((a) => a.kind === 'sleep');
    const day = dayBurn({
      bmr: body?.bmr ?? 0,
      sleepMinutes: sleep.reduce((s, a) => s + a.minutes, 0),
      sleepCalories: sleep.reduce((s, a) => s + a.calories, 0),
      activeCalories: todays.filter((a) => a.kind !== 'sleep').reduce((s, a) => s + a.calories, 0),
    });

    return {
      ...day,
      sleepMinutes: Math.round(sleep.reduce((s, a) => s + a.minutes, 0)),
      // Each day's whole burn (body + sleep + active), like the big number for today.
      week: lastNDays(date, 7).map((d) => {
        const dayRows = rows.filter((a) => a.localDate === d);
        const slept = dayRows.filter((a) => a.kind === 'sleep');
        const sleepCalories = slept.reduce((s, a) => s + a.calories, 0);
        const active = dayRows
          .filter((a) => a.kind !== 'sleep')
          .reduce((s, a) => s + a.calories, 0);
        const total =
          body && d >= body.since
            ? dayBurn({
                bmr: body.bmr,
                sleepMinutes: slept.reduce((s, a) => s + a.minutes, 0),
                sleepCalories,
                activeCalories: active,
              }).total
            : sleepCalories + active;
        return { date: d, active, total };
      }),
      activities: todays.map(toView),
    };
  },

  /** A manual activity log (minutes or watch kcal). No photo proof since 1.1. */
  async log(profileId: string, input: LogActivityInput, opts: { sessionId?: string } = {}) {
    const body = await bodyOf(profileId);
    if (!body) throw new AppError(409, 'Finish onboarding before logging activity');

    // A library exercise brings its own kind, name and intensity.
    const exercise = input.exerciseId
      ? await exerciseService.get(profileId, input.date, input.exerciseId)
      : null;
    const kind = exercise?.kind ?? input.kind!;
    const met = exercise?.met ?? MET[kind];
    const label = exercise?.name ?? LABELS[kind];
    // Typed kcal (from a watch) is trusted as-is; otherwise MET × weight × time.
    const calories = input.calories ?? activeKcalAt(met, input.minutes!, body.kg);
    const minutes = input.minutes ?? Math.round(calories / (((met - 1) * body.kg) / 60));

    // A walk logged here also moves a walking challenge (activity and challenge stay in step).
    const running = await ensureTracking(
      await db
        .select()
        .from(challenges)
        .where(activeChallenges(profileId, input.date))
        .orderBy(asc(challenges.createdAt)),
    );
    const match = running
      .map((c) => ({ c, amount: challengeAmountFromActivity({ kind, minutes }, c, c.tracking) }))
      .find((m) => m.amount !== null && m.amount > 0);

    const row = await db.transaction(async (tx) => {
      const log = match
        ? (
            await tx
              .insert(challengeLogs)
              .values({
                challengeId: match.c.id,
                profileId,
                localDate: input.date,
                amount: match.amount!,
                source: 'activity',
              })
              .returning({ id: challengeLogs.id })
          )[0]
        : undefined;
      const [inserted] = await tx
        .insert(activities)
        .values({
          profileId,
          localDate: input.date,
          kind,
          exerciseId: exercise?.id ?? null,
          exerciseName: exercise?.name ?? null,
          minutes,
          calories,
          caloriesFromUser: input.calories !== undefined,
          challengeLogId: log?.id ?? null,
          source: 'logged',
          // A tracked workout: its trophy card opens from this activity.
          sessionId: opts.sessionId ?? null,
        })
        .returning();
      return inserted!;
    });
    return {
      verified: true as const,
      note: null,
      activity: toView(row),
      credited: match
        ? {
            challengeId: match.c.id,
            label: match.c.tracking.label ?? match.c.title,
            amount: match.amount,
          }
        : null,
    };
  },

  /** Sleep logged without a sleep challenge (e.g. from the assistant). */
  async logSleep(profileId: string, input: { date: string; hours: number }) {
    const body = await bodyOf(profileId);
    if (!body) throw new AppError(409, 'Finish onboarding before logging sleep');
    const hours = Math.min(MAX_SLEEP_HOURS, Math.max(0.5, input.hours));
    const minutes = hours * 60;
    const [row] = await db
      .insert(activities)
      .values({
        profileId,
        localDate: input.date,
        kind: 'sleep',
        minutes,
        calories: sleepKcal(minutes, body.kg),
      })
      .returning();
    return { verified: true as const, note: null, activity: toView(row!) };
  },

  /**
   * Removes a logged activity. One logged here that credited a challenge takes the credit with
   * it (deleting the log cascades to the activity). Activities created BY a challenge log are
   * removed from the challenge side instead.
   */
  async remove(profileId: string, id: string) {
    const [row] = await db
      .select({ id: activities.id, logId: activities.challengeLogId, source: activities.source })
      .from(activities)
      .where(and(eq(activities.id, id), eq(activities.profileId, profileId)));
    if (!row || (row.logId && row.source !== 'logged')) throw AppError.notFound('Activity');
    // Deleting its challenge credit cascades to the activity; otherwise delete it directly.
    if (row.logId) await db.delete(challengeLogs).where(eq(challengeLogs.id, row.logId));
    else await db.delete(activities).where(eq(activities.id, row.id));
  },

  /**
   * After a verified movement/sleep challenge log: record the matching burn in the same
   * transaction. `amount` is what the user did (not capped by the challenge goal).
   */
  async fromChallengeLog(
    tx: Writer,
    args: {
      profileId: string;
      challenge: Pick<Challenge, 'title' | 'category'>;
      tracking: ChallengeTracking;
      amount: number;
      date: string;
      challengeLogId: string;
      source?: string;
      sessionId?: string;
    },
  ) {
    const act = activityFromChallenge(args.challenge, args.tracking, args.amount);
    if (!act) return null;
    const body = await bodyOf(args.profileId);
    if (!body) return null;
    const kg = body.kg;
    const calories =
      act.kind === 'sleep' ? sleepKcal(act.minutes, kg) : activeKcal(act.kind, act.minutes, kg);
    await tx.insert(activities).values({
      profileId: args.profileId,
      localDate: args.date,
      kind: act.kind,
      minutes: act.minutes,
      calories,
      challengeLogId: args.challengeLogId,
      source: args.source ?? 'manual',
      sessionId: args.sessionId ?? null,
    });
    return { kind: act.kind, calories };
  },
};
