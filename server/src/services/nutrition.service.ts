import type { OnboardingInput } from '../validators/profile.validator';

type Body = Pick<OnboardingInput, 'sex' | 'age' | 'heightCm' | 'weightKg' | 'activityLevel'>;
type GoalType = OnboardingInput['goal']['type'];

const ACTIVITY_MULTIPLIER = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
} as const;

// kcal/day added to maintenance. -500 ≈ 0.5 kg loss per week, a safe pace.
const GOAL_CALORIE_DELTA: Record<GoalType, number> = {
  lose_weight: -500,
  gain_muscle: 300,
  maintain: 0,
  eat_healthier: 0,
};

const PROTEIN_G_PER_KG: Record<GoalType, number> = {
  lose_weight: 1.6,
  gain_muscle: 1.8,
  maintain: 1.2,
  eat_healthier: 1.2,
};

// Never recommend crash-diet calories.
const MIN_CALORIES = { female: 1200, male: 1500, other: 1350 };

// The equation has a male (+5) and a female (-161) constant; for "other" we use their midpoint.
const SEX_CONSTANT = { male: 5, female: -161, other: -78 };

// Mifflin–St Jeor equation: the standard estimate of calories burned at rest.
function bmr({ sex, age, heightCm, weightKg }: Body) {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + SEX_CONSTANT[sex];
}

/**
 * Weight that protein is calculated from. Fat tissue doesn't need protein, so with a high BMI
 * we use the goal weight (or the weight at BMI 25 if there's no target) instead of current weight.
 * e.g. 90 kg → 75 kg: 1.6 × 75 = 120 g, not 144 g, which is also far more achievable.
 */
function proteinReferenceWeight(body: Body, goal: GoalType, targetWeightKg: number | null) {
  const m = body.heightCm / 100;
  const weightAtBmi25 = 25 * m * m;
  if (goal !== 'lose_weight' || body.weightKg <= weightAtBmi25) return body.weightKg;
  return targetWeightKg ?? weightAtBmi25;
}

export function calculateDailyTargets(
  body: Body,
  goal: GoalType,
  targetWeightKg: number | null = null,
) {
  const maintenance = bmr(body) * ACTIVITY_MULTIPLIER[body.activityLevel];
  const target = Math.max(
    MIN_CALORIES[body.sex],
    Math.round(maintenance + GOAL_CALORIE_DELTA[goal]),
  );
  const proteinG = Math.round(
    proteinReferenceWeight(body, goal, targetWeightKg) * PROTEIN_G_PER_KG[goal],
  );
  const fatG = Math.round((target * 0.28) / 9); // 28% of calories from fat
  const carbsG = Math.max(0, Math.round((target - proteinG * 4 - fatG * 9) / 4));

  // Rounding grams can drift the parts 1–2 kcal from the target. Make the total the exact
  // sum of its parts (protein & carbs 4 kcal/g, fat 9), so what the app shows always adds up.
  const dailyCalories = proteinG * 4 + carbsG * 4 + fatG * 9;

  return { dailyCalories, proteinG, carbsG, fatG };
}
