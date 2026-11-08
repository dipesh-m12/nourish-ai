/**
 * Deterministic diet and allergy rules, matched on food names. The AI also flags conflicts,
 * but this is the guarantee: a veg user's chicken never counts toward their plan.
 */

const MEAT = [
  'chicken',
  'mutton',
  'lamb',
  'goat',
  'beef',
  'pork',
  'bacon',
  'ham',
  'sausage',
  'keema',
  'salami',
  'pepperoni',
  'turkey',
  'duck',
  'meat',
];
const FISH = [
  'fish',
  'prawn',
  'shrimp',
  'crab',
  'lobster',
  'tuna',
  'salmon',
  'squid',
  'seafood',
  'surmai',
  'pomfret',
];
const EGG = ['egg', 'omelette', 'omelet', 'anda'];
const DAIRY = [
  'paneer',
  'curd',
  'milk',
  'ghee',
  'cheese',
  'raita',
  'butter',
  'yogurt',
  'yoghurt',
  'lassi',
  'cream',
  'khoya',
  'kheer',
  'dahi',
  'buttermilk',
  'chaas',
];
/** Jain food avoids root vegetables. */
const ROOTS = [
  'onion',
  'garlic',
  'potato',
  'aloo',
  'carrot',
  'beetroot',
  'radish',
  'mooli',
  'ginger',
  'yam',
];

const DIET_EXCLUDES: Record<string, string[]> = {
  veg: [...MEAT, ...FISH, ...EGG],
  eggetarian: [...MEAT, ...FISH],
  vegan: [...MEAT, ...FISH, ...EGG, ...DAIRY],
  jain: [...MEAT, ...FISH, ...EGG, ...ROOTS],
};

const DIET_NAMES: Record<string, string> = {
  veg: 'vegetarian',
  eggetarian: 'eggetarian',
  vegan: 'vegan',
  jain: 'Jain',
};

/** Ingredients that reveal a common allergen in a food name. Custom allergies match by name. */
export const ALLERGEN_KEYWORDS: Record<string, string[]> = {
  dairy: DAIRY, // same list as vegan, so butter naan or kheer is caught too
  gluten: ['roti', 'toast', 'multigrain', 'paratha', 'wheat'],
  eggs: ['egg'],
  fish: ['fish'],
  shellfish: ['prawn', 'shrimp', 'crab'],
  soy: ['tofu', 'soy'],
  peanuts: ['peanut'],
  'tree nuts': ['almond', 'cashew', 'walnut', 'pista'],
};

/** Whole-word match, allowing plurals ("eggs" yes, "eggplant" no). */
function mentions(text: string, words: string[]) {
  // "Peanut butter" isn't dairy: drop plant butters before matching.
  const plain = text.replace(/\b(peanut|almond|cashew|nut|cocoa|apple)\s+butter\b/gi, '$1');
  return words.some((w) => new RegExp(`\\b${w}(e?s)?\\b`, 'i').test(plain));
}

export function containsAllergen(food: string, allergies: string[]) {
  return allergies.some((a) => {
    const key = a.toLowerCase();
    return mentions(food, ALLERGEN_KEYWORDS[key] ?? [key]);
  });
}

export interface DietConflict {
  item: string;
  /** Shown to the user, e.g. "not in your vegetarian plan". */
  reason: string;
}

/** Foods that break the user's diet or allergies. `flagged` = extra names the AI marked. */
export function dietConflicts(
  items: string[],
  diet: string | null,
  allergies: string[],
  flagged: string[] = [],
): DietConflict[] {
  const excluded = diet ? (DIET_EXCLUDES[diet] ?? []) : [];
  const aiFlagged = new Set(flagged.map((f) => f.toLowerCase()));
  return items.flatMap((item) => {
    if (containsAllergen(item, allergies)) return [{ item, reason: 'one of your allergies' }];
    if (
      mentions(item, excluded) ||
      (diet && DIET_EXCLUDES[diet] && aiFlagged.has(item.toLowerCase()))
    ) {
      return [{ item, reason: `not in your ${DIET_NAMES[diet!]} plan` }];
    }
    return [];
  });
}

/** One friendly line for the first conflict, e.g. "Chicken curry is not in your vegetarian plan". */
export function conflictMessage(conflicts: DietConflict[]): string | null {
  const first = conflicts[0];
  if (!first) return null;
  const more = conflicts.length > 1 ? ` (and ${conflicts.length - 1} more)` : '';
  return `${first.item}${more} is ${first.reason}, so it won’t count toward your challenges.`;
}
