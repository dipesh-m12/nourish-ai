import { and, asc, eq, inArray, notInArray, sql } from 'drizzle-orm';
import { db } from '../../db';
import {
  challenges,
  goals,
  plans,
  profiles,
  type Challenge,
  type Goal,
  type Plan,
  type PlanMetrics,
} from '../../db/schema';
import { AppError } from '../../utils/app-error';
import { generateStructured } from '../ai/ai.service';
import { bmiCategory, calculateBmi, estimateWeeks } from '../metrics.service';
import { buildPlanUserPrompt, PLAN_SYSTEM_PROMPT, type PlanContext } from './plan.prompt';
import { aiPlanSchema, type AiPlan } from './plan.schema';
import { templatePlan } from './plan.template';

/** The sample day may be off from the target by at most this much before we reject it. */
const SAMPLE_DAY_TOLERANCE = 0.1;

/** Loads the onboarded profile + goal and derives the facts the plan is built on. */
async function loadContext(profileId: string): Promise<PlanContext> {
  const profile = await db.query.profiles.findFirst({ where: eq(profiles.id, profileId) });
  if (!profile) throw AppError.notFound('Profile');
  const goal = await db.query.goals.findFirst({ where: eq(goals.profileId, profileId) });
  if (!profile.onboardedAt || !goal || !profile.heightCm || !profile.weightKg) {
    throw new AppError(409, 'Finish onboarding before building a plan');
  }
  const bmi = calculateBmi(profile.heightCm, profile.weightKg);
  return {
    profile,
    goal,
    bmi,
    bmiCategory: bmiCategory(bmi),
    estimatedWeeks: estimateWeeks(profile.weightKg, goal.targetWeightKg),
  };
}

/** Freezes the numbers this plan is based on, so it stays truthful if the goal changes later. */
function snapshotMetrics({
  profile,
  goal,
  bmi,
  bmiCategory,
  estimatedWeeks,
}: PlanContext): PlanMetrics {
  return {
    bmi,
    bmiCategory,
    startWeightKg: profile.weightKg!,
    targetWeightKg: goal.targetWeightKg,
    estimatedWeeks,
    dailyCalories: goal.dailyCalories,
    proteinG: goal.proteinG,
    carbsG: goal.carbsG,
    fatG: goal.fatG,
  };
}

/** Rule the schema can't express: the sample day must add up to (roughly) the calorie target. */
function checkSampleDay(target: number) {
  return (plan: AiPlan) => {
    const total = plan.sampleDay.reduce((sum, m) => sum + m.kcal, 0);
    const off = Math.abs(total - target) / target;
    return off > SAMPLE_DAY_TOLERANCE
      ? `sample day is ${total} kcal, target ${target} (${Math.round(off * 100)}% off)`
      : null;
  };
}

function toChallengeView({ id, title, target, why, frequency, category, accepted }: Challenge) {
  return { id, title, target, why, frequency, category, accepted };
}

/** What the app receives: frozen metrics + AI content + the challenges to choose from. */
function toPlanView(plan: Plan, goal: Pick<Goal, 'type' | 'why'>, items: Challenge[]) {
  return {
    metrics: plan.metrics,
    goal: { type: goal.type, why: goal.why },
    summary: plan.summary,
    encouragement: plan.encouragement,
    focusHabits: plan.focusHabits,
    sampleDay: plan.sampleDay,
    challenges: items.map(toChallengeView),
    source: plan.source,
    createdAt: plan.createdAt,
  };
}

export const planService = {
  /**
   * Builds (or rebuilds) the plan. AI writes the personal parts; if every provider fails or
   * breaks a rule, the template keeps onboarding working. A new plan replaces its suggestions.
   */
  async generate(profileId: string) {
    const ctx = await loadContext(profileId);

    let content: AiPlan;
    let source = 'template';
    let model: string | null = null;
    try {
      const result = await generateStructured(
        aiPlanSchema,
        { system: PLAN_SYSTEM_PROMPT, user: buildPlanUserPrompt(ctx) },
        checkSampleDay(ctx.goal.dailyCalories),
      );
      ({ data: content, provider: source, model } = result);
    } catch (err) {
      console.warn(
        '[plan] AI unavailable, using template:',
        err instanceof Error ? err.message : err,
      );
      content = templatePlan(ctx);
    }

    const { challenges: suggested, ...planFields } = content;
    const values = { ...planFields, metrics: snapshotMetrics(ctx), source, model };

    const [plan, items] = await db.transaction(async (tx) => {
      const [saved] = await tx
        .insert(plans)
        .values({ profileId, ...values })
        .onConflictDoUpdate({ target: plans.profileId, set: { ...values, createdAt: new Date() } })
        .returning();
      await tx.delete(challenges).where(eq(challenges.profileId, profileId));
      const inserted = await tx
        .insert(challenges)
        .values(suggested.map((c) => ({ ...c, profileId })))
        .returning();
      return [saved!, inserted] as const;
    });

    return toPlanView(plan, ctx.goal, items);
  },

  async get(profileId: string) {
    const plan = await db.query.plans.findFirst({ where: eq(plans.profileId, profileId) });
    const goal = await db.query.goals.findFirst({ where: eq(goals.profileId, profileId) });
    if (!plan || !goal) throw AppError.notFound('Plan');
    const items = await db
      .select()
      .from(challenges)
      .where(eq(challenges.profileId, profileId))
      .orderBy(asc(challenges.createdAt), asc(challenges.id));
    return toPlanView(plan, goal, items);
  },

  /** Marks exactly `acceptedIds` as taken on; everything else for this profile as not. */
  async setAcceptedChallenges(profileId: string, acceptedIds: string[]) {
    return db.transaction(async (tx) => {
      const mine = eq(challenges.profileId, profileId);
      // acceptedAt starts the challenge's history: set it only when newly taken on, so
      // re-saving the picker doesn't reset anyone's streak; cleared when dropped.
      if (acceptedIds.length) {
        await tx
          .update(challenges)
          .set({ accepted: true, acceptedAt: sql`coalesce(${challenges.acceptedAt}, now())` })
          .where(and(mine, inArray(challenges.id, acceptedIds)));
        await tx
          .update(challenges)
          .set({ accepted: false, acceptedAt: null })
          .where(and(mine, notInArray(challenges.id, acceptedIds)));
      } else {
        await tx.update(challenges).set({ accepted: false, acceptedAt: null }).where(mine);
      }
      const rows = await tx
        .select()
        .from(challenges)
        .where(mine)
        .orderBy(asc(challenges.createdAt), asc(challenges.id));
      return rows.map(toChallengeView);
    });
  },
};

export type PlanView = ReturnType<typeof toPlanView>;
