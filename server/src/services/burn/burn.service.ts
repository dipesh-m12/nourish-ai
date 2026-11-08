import { and, asc, eq, gte, isNull, lte } from 'drizzle-orm';
import { db } from '../../db';
import {
  activities,
  profiles,
  type Activity,
  type ActivityKind,
  type Challenge,
  type ChallengeTracking,
} from '../../db/schema';
import { AppError } from '../../utils/app-error';
import { addDays, lastNDays } from '../../utils/dates';
import type { LogActivityInput } from '../../validators/activity.validator';
import { verifyProof } from '../challenges/proof.service';
import { bmr } from '../nutrition.service';
import { exerciseService } from '../exercises/exercise.service';
import {
  activeKcal,
  activeKcalAt,
  activityFromChallenge,
  dayBurn,
  MAX_SLEEP_HOURS,
  MET,
  sleepKcal,
} from './burn.math';
import type { ImageInput } from '../ai/llm-provider';

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
    fromChallenge: a.challengeLogId !== null,
    createdAt: a.createdAt,
  };
}

async function bodyOf(profileId: string) {
  const p = await db.query.profiles.findFirst({ where: eq(profiles.id, profileId) });
  if (!p?.sex || !p.age || !p.heightCm || !p.weightKg) return null;
  return {
    kg: p.weightKg,
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
  /** Today's burn split (resting / sleep / active), the last 7 days of active kcal, and the log. */
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
      week: lastNDays(date, 7).map((d) => ({
        date: d,
        active: rows
          .filter((a) => a.localDate === d && a.kind !== 'sleep')
          .reduce((s, a) => s + a.calories, 0),
      })),
      activities: todays.map(toView),
    };
  },

  /** A logged activity counts only with a photo the AI accepts, like challenges. */
  async log(profileId: string, input: LogActivityInput) {
    const body = await bodyOf(profileId);
    if (!body) throw new AppError(409, 'Finish onboarding before logging activity');

    // A library exercise brings its own kind, name and intensity.
    const exercise = input.exerciseId
      ? await exerciseService.get(profileId, input.date, input.exerciseId)
      : null;
    const kind = exercise?.kind ?? input.kind!;
    const met = exercise?.met ?? MET[kind];
    const label = exercise?.name ?? LABELS[kind];
    const amount = input.minutes ? `${input.minutes} min` : `${input.calories} kcal`;
    let verdict;
    try {
      verdict = await verifyProof(
        { title: `${label} (${amount})`, target: amount, frequency: 'daily' },
        {
          kind: 'check',
          unit: null,
          target: 1,
          step: 1,
          widget: 'check',
          proof: `you doing ${label.toLowerCase()}, the place, your gear, or a fitness tracker screen`,
        },
        input.image,
      );
    } catch {
      throw new AppError(502, 'We couldn’t check your photo right now. Please try again.');
    }
    if (!verdict.verified) return { verified: false as const, note: verdict.note };

    // Typed kcal (from a watch) is trusted as-is; otherwise MET × weight × time.
    const calories = input.calories ?? activeKcalAt(met, input.minutes!, body.kg);
    const minutes = input.minutes ?? Math.round(calories / (((met - 1) * body.kg) / 60));
    const [row] = await db
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
        proofNote: verdict.note,
      })
      .returning();
    return { verified: true as const, note: verdict.note, activity: toView(row!) };
  },

  /**
   * Sleep logged without a sleep challenge (e.g. from the assistant). Same proof rule as every
   * other log: the AI checks the photo first.
   */
  async logSleep(profileId: string, input: { date: string; hours: number; image: ImageInput }) {
    const body = await bodyOf(profileId);
    if (!body) throw new AppError(409, 'Finish onboarding before logging sleep');
    const hours = Math.min(MAX_SLEEP_HOURS, Math.max(0.5, input.hours));
    let verdict;
    try {
      verdict = await verifyProof(
        { title: `Slept ${hours} hours`, target: `${hours} h`, frequency: 'daily' },
        {
          kind: 'check',
          unit: null,
          target: 1,
          step: 1,
          widget: 'check',
          proof: 'a bed, pillow, dark bedroom, alarm or sleep-tracker screen',
        },
        input.image,
      );
    } catch {
      throw new AppError(502, 'We couldn’t check your photo right now. Please try again.');
    }
    if (!verdict.verified) return { verified: false as const, note: verdict.note };
    const minutes = hours * 60;
    const [row] = await db
      .insert(activities)
      .values({
        profileId,
        localDate: input.date,
        kind: 'sleep',
        minutes,
        calories: sleepKcal(minutes, body.kg),
        proofNote: verdict.note,
      })
      .returning();
    return { verified: true as const, note: verdict.note, activity: toView(row!) };
  },

  async remove(profileId: string, id: string) {
    const [row] = await db
      .delete(activities)
      .where(
        and(
          eq(activities.id, id),
          eq(activities.profileId, profileId),
          isNull(activities.challengeLogId),
        ),
      )
      .returning({ id: activities.id });
    if (!row) throw AppError.notFound('Activity');
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
    });
    return { kind: act.kind, calories };
  },
};
