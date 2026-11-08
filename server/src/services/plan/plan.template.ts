import type { AiPlan } from './plan.schema';
import type { PlanContext } from './plan.prompt';
import { containsAllergen } from '../diet-rules';

/**
 * Used when every AI provider fails (outage, rate limit, no key). Less personal, but
 * always valid and diet-safe, so onboarding never dead-ends on an AI error.
 */
export function templatePlan({ profile, goal, estimatedWeeks }: PlanContext): AiPlan {
  const kcal = goal.dailyCalories;
  const meals = mealsFor(profile.dietType).map((m) =>
    containsAllergen(m, profile.allergies) ? SAFE_MEAL : m,
  );
  const split = [0.25, 0.35, 0.1, 0.3]; // breakfast, lunch, snack, dinner

  return {
    summary: `Your plan centres on ${kcal} kcal and ${goal.proteinG} g of protein a day, with steady habits you can keep. Small daily wins will add up to what matters to you.`,
    encouragement: estimatedWeeks
      ? `About ${estimatedWeeks} weeks at a safe pace. Very doable, one day at a time.`
      : 'Consistency beats perfection. Start small and keep showing up.',
    focusHabits: [
      {
        title: 'Protein in every meal',
        why: `It keeps you full and helps you reach ${goal.proteinG} g a day.`,
      },
      {
        title: 'Half your plate vegetables',
        why: 'Fibre and volume for few calories, so meals still feel big.',
      },
      {
        title: 'Log meals as you eat',
        why: 'Seeing the day add up is the easiest way to stay on target.',
      },
    ],
    sampleDay: (['breakfast', 'lunch', 'snack', 'dinner'] as const).map((slot, i) => ({
      slot,
      meal: meals[i]!,
      kcal: Math.round(kcal * split[i]!),
    })),
    challenges: [
      {
        title: 'Walk after a meal',
        target: '15 min',
        why: 'Helps digestion and steadies blood sugar.',
        frequency: 'daily',
        category: 'movement',
      },
      {
        title: 'Strength or yoga session',
        target: '3 times a week',
        why: 'Builds muscle, which burns more energy at rest.',
        frequency: 'weekly',
        category: 'movement',
      },
      {
        title: 'Protein with breakfast',
        target: '20 g',
        why: 'A strong start curbs mid-morning snacking.',
        frequency: 'daily',
        category: 'nutrition',
      },
      {
        title: 'Two vegetable servings',
        target: '2 bowls',
        why: 'Adds fibre and keeps you full for longer.',
        frequency: 'daily',
        category: 'nutrition',
      },
      {
        title: 'Drink enough water',
        target: '2.5 L',
        why: 'Thirst often feels like hunger.',
        frequency: 'daily',
        category: 'hydration',
      },
      {
        title: 'Consistent bedtime',
        target: '7 hours',
        why: 'Poor sleep raises cravings the next day.',
        frequency: 'daily',
        category: 'sleep',
      },
    ],
  };
}

/** Plain rice-and-moong khichdi: free of every common allergen in our list. */
const SAFE_MEAL = 'Moong dal khichdi with cucumber salad';

/** Defaults per diet (no root vegetables for Jain, no dairy for vegan). */
function mealsFor(diet: string | null): string[] {
  switch (diet) {
    case 'non_veg':
      return [
        '2 egg omelette with 1 multigrain toast',
        'Chicken curry, 1 cup rice, salad',
        'Roasted chana, 1 small bowl',
        'Grilled fish, 2 rotis, sautéed vegetables',
      ];
    case 'eggetarian':
      return [
        '2 boiled eggs with 1 multigrain toast',
        'Dal, 1 cup rice, salad',
        'Roasted chana, 1 small bowl',
        'Egg bhurji, 2 rotis, sautéed vegetables',
      ];
    case 'vegan':
      return [
        'Vegetable poha with sprouts',
        'Rajma, 1 cup rice, salad',
        'Roasted chana, 1 small bowl',
        'Tofu bhurji, 2 rotis, sautéed vegetables',
      ];
    case 'jain':
      return [
        '2 moong dal chillas',
        'Toor dal, 1 cup rice, cucumber salad',
        'Roasted makhana, 1 small bowl',
        'Paneer sabzi (no onion/garlic), 2 rotis',
      ];
    default:
      return [
        '2 moong dal chillas with mint chutney',
        'Dal, 1 cup rice, salad, curd',
        'Roasted chana, 1 small bowl',
        'Paneer bhurji, 2 rotis, sautéed vegetables',
      ];
  }
}
