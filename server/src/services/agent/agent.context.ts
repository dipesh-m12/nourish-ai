import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../db';
import { goals, profiles } from '../../db/schema';
import { AppError } from '../../utils/app-error';
import { challengeProgressService } from '../challenges/challenge-progress.service';
import { planService } from '../plan/plan.service';

export type PartOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

/** The user's local clock from their UTC offset (minutes east). */
export function localClock(tzOffsetMinutes: number, now = new Date()) {
  const local = new Date(now.getTime() + tzOffsetMinutes * 60_000);
  const hour = local.getUTCHours();
  const part: PartOfDay =
    hour >= 5 && hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 22 ? 'evening' : 'night';
  const hhmm = `${String(hour).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;
  return { hour, part, hhmm };
}

/**
 * Everything the assistant knows about the user right now: who they are, their goal and why,
 * and today's numbers. Built from the same services the dashboard uses, so they always agree.
 */
export async function buildContext(profileId: string, date: string, tz: number) {
  const [profile, goal, today, plan] = await Promise.all([
    db.query.profiles.findFirst({
      where: and(eq(profiles.id, profileId), isNull(profiles.deletedAt)),
    }),
    db.query.goals.findFirst({ where: eq(goals.profileId, profileId) }),
    challengeProgressService.today(profileId, date, tz),
    planService.get(profileId).catch((err: unknown) => {
      if (err instanceof AppError && err.statusCode === 404) return null;
      throw err; // An unavailable plan isn't the same as an empty plan.
    }),
  ]);
  if (!profile || !goal || !today.targets) {
    throw new AppError(409, 'Finish onboarding to use the assistant');
  }
  const clock = localClock(tz);
  const left = today.targets.calories - today.eaten.calories;

  return {
    clock,
    tz,
    name: profile.name,
    raw: today,
    /** What goes into the prompt: compact, numbers already computed. */
    prompt: {
      now: `${date} ${clock.hhmm} (${clock.part})`,
      user: {
        name: profile.name,
        age: profile.age,
        sex: profile.sex,
        heightCm: profile.heightCm,
        activityLevel: profile.activityLevel,
        diet: profile.dietType,
        allergies: profile.allergies,
        weightKg: profile.weightKg,
      },
      goal: {
        type: goal.type,
        why: goal.why,
        targetWeightKg: goal.targetWeightKg,
        dailyCalories: goal.dailyCalories,
        proteinG: goal.proteinG,
        carbsG: goal.carbsG,
        fatG: goal.fatG,
      },
      plan: plan
        ? {
            summary: plan.summary,
            focusHabits: plan.focusHabits,
            sampleDay: plan.sampleDay,
            metrics: plan.metrics,
          }
        : null,
      today: {
        targets: today.targets,
        eaten: today.eaten,
        kcalLeft: left,
        meals: today.meals.map((m) => ({
          id: m.id,
          title: m.title,
          items: m.items,
          kcal: m.calories,
          at: m.createdAt,
        })),
        burn: {
          total: today.burn.total,
          active: today.burn.active,
          resting: today.burn.resting,
          sleep: today.burn.sleep,
          sleepMinutes: today.burn.sleepMinutes,
        },
        activities: today.burn.activities.map((a) => ({
          id: a.id,
          label: a.label,
          minutes: a.minutes,
          kcal: a.calories,
          at: a.createdAt,
        })),
      },
      // Every accepted challenge (water, sleep, walks, food…), so the assistant can log any of them.
      challenges: today.challenges.map((c) => ({
        id: c.id,
        label: c.tracking.label ?? c.title,
        title: c.title,
        why: c.why,
        targetDescription: c.target,
        category: c.category,
        kind: c.tracking.kind,
        widget: c.tracking.widget,
        frequency: c.frequency,
        unit: c.tracking.kind === 'check' ? 'done' : c.tracking.unit,
        oneTap: c.tracking.step,
        target: c.progress.goal,
        doneSoFar: c.progress.value,
        done: c.progress.done,
        streak: c.progress.streak,
        /** "meal" = logged as a meal (food photo); "proof" = a photo of the activity itself. */
        logsVia: c.logsVia,
        photoShows: c.tracking.proof,
        missed: c.progress.missed,
        startedOn: c.progress.startedOn,
      })),
      planChallenges: (plan?.challenges ?? []).map((c) => ({
        id: c.id,
        title: c.title,
        accepted: c.accepted,
        target: c.target,
        why: c.why,
        category: c.category,
        frequency: c.frequency,
      })),
    },
  };
}

export type AgentContext = Awaited<ReturnType<typeof buildContext>>;

/** Read tools: a fresh slice of the user's data, so the assistant never answers from stale numbers. */
export function readSlice(ctx: AgentContext, tool: string, query = '') {
  const p = ctx.prompt;
  switch (tool) {
    case 'get_today':
      return { now: p.now, today: p.today, challenges: p.challenges };
    case 'get_challenges':
      return {
        today: p.challenges,
        plan: p.planChallenges,
        ...(query === 'history' && {
          history: ctx.raw.challenges.map((c) => ({
            id: c.id,
            label: c.tracking.label ?? c.title,
            days: c.progress.history,
          })),
        }),
      };
    case 'get_meals':
      return { meals: p.today.meals, eaten: p.today.eaten, kcalLeft: p.today.kcalLeft };
    case 'get_activities':
      return { activities: p.today.activities, burn: p.today.burn };
    case 'get_profile':
      return { user: p.user, goal: p.goal };
    case 'get_plan':
      return { plan: p.plan, challenges: p.planChallenges };
    default:
      return null;
  }
}
