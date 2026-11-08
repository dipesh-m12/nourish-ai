import { eq } from 'drizzle-orm';
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
    db.query.profiles.findFirst({ where: eq(profiles.id, profileId) }),
    db.query.goals.findFirst({ where: eq(goals.profileId, profileId) }),
    challengeProgressService.today(profileId, date, tz),
    planService.get(profileId).catch(() => null), // no plan yet is fine
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
        diet: profile.dietType,
        allergies: profile.allergies,
        weightKg: profile.weightKg,
      },
      goal: { type: goal.type, why: goal.why, targetWeightKg: goal.targetWeightKg },
      today: {
        targets: today.targets,
        eaten: today.eaten,
        kcalLeft: left,
        meals: today.meals.map((m) => ({ title: m.title, kcal: m.calories, at: m.createdAt })),
        burn: {
          total: today.burn.total,
          active: today.burn.active,
          sleepMinutes: today.burn.sleepMinutes,
        },
        activities: today.burn.activities.map((a) => ({
          label: a.label,
          minutes: a.minutes,
          kcal: a.calories,
        })),
      },
      // Every accepted challenge (water, sleep, walks, food…), so the assistant can log any of them.
      challenges: today.challenges.map((c) => ({
        id: c.id,
        label: c.tracking.label ?? c.title,
        title: c.title,
        category: c.category,
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
      })),
      planChallenges: (plan?.challenges ?? []).map((c) => ({
        id: c.id,
        title: c.title,
        accepted: c.accepted,
      })),
    },
  };
}

export type AgentContext = Awaited<ReturnType<typeof buildContext>>;

/** Read tools: a fresh slice of the user's data, so the assistant never answers from stale numbers. */
export function readSlice(ctx: AgentContext, tool: string) {
  const p = ctx.prompt;
  switch (tool) {
    case 'get_today':
      return { now: p.now, today: p.today, challenges: p.challenges };
    case 'get_challenges':
      return { today: p.challenges, plan: p.planChallenges };
    case 'get_meals':
      return { meals: p.today.meals, eaten: p.today.eaten, kcalLeft: p.today.kcalLeft };
    case 'get_activities':
      return { activities: p.today.activities, burn: p.today.burn };
    case 'get_profile':
      return { user: p.user, goal: p.goal };
    default:
      return null;
  }
}
