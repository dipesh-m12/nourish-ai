import type { Challenge } from '../../db/schema';

// Food words in a title/target. Category alone isn't enough: "Log meals each night" is filed
// under mindset, yet its photo is a plate of food and must count toward calories.
const FOOD_WORDS =
  /\b(meals?|food|eat|eating|salad|protein|fruits?|veg|veggies|vegetables?|greens|breakfast|lunch|dinner|snacks?|sugar|fib(re|er)|dal|curd|paneer|tofu|thali|plate)\b/i;

/** Is this challenge logged by photographing food (so it should go through meal logging)? */
export function isFoodChallenge(c: Pick<Challenge, 'title' | 'target' | 'category'>): boolean {
  if (c.category === 'nutrition') return true;
  if (c.category === 'hydration' || c.category === 'movement' || c.category === 'sleep')
    return false;
  return FOOD_WORDS.test(`${c.title} ${c.target}`);
}

/** Challenges a logged meal may credit: food ones, plus drinks (a glass of water on the tray). */
export function canCreditFromMeal(c: Pick<Challenge, 'title' | 'target' | 'category'>): boolean {
  return isFoodChallenge(c) || c.category === 'hydration';
}
