import type { MealItem } from '@/types/meal';
import type { Macros } from '@/types/today';

/**
 * A meal item while the user reviews it: the AI's original (`base`) plus how much of it they
 * actually had (`scale`). Edits never overwrite `base`, so ×2 then ×1 lands exactly back.
 */
export interface ItemEntry {
  key: string;
  base: MealItem;
  scale: number;
  /** Set when this food breaks the diet or an allergy. */
  warning: string | null;
}

export const MIN_SCALE = 0.25;
export const MAX_SCALE = 6;

let nextKey = 0;
export function toEntry(item: MealItem, warning: string | null = null): ItemEntry {
  nextKey += 1;
  return { key: `item-${nextKey}`, base: item, scale: 1, warning };
}

const kcal = (p: number, c: number, f: number) => Math.round(p * 4 + c * 4 + f * 9);

/** Same 4/4/9 rule the server uses, so what's shown is exactly what gets saved. */
export function scaledItem({ base, scale }: ItemEntry): MealItem {
  const proteinG = Math.round(base.proteinG * scale);
  const carbsG = Math.round(base.carbsG * scale);
  const fatG = Math.round(base.fatG * scale);
  const portion = scale === 1 ? base.portion : `${base.portion} ×${trim(scale)}`;
  return {
    name: base.name,
    portion: portion.slice(0, 40),
    proteinG,
    carbsG,
    fatG,
    calories: kcal(proteinG, carbsG, fatG),
  };
}

/** Scale that makes the item land on a typed calorie number (macros keep their ratio). */
export function scaleForCalories(entry: ItemEntry, calories: number): number {
  const baseKcal = kcal(entry.base.proteinG, entry.base.carbsG, entry.base.fatG);
  if (baseKcal <= 0) return entry.scale;
  return clampScale(calories / baseKcal);
}

export function clampScale(s: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(s * 100) / 100));
}

export function totalsOf(items: MealItem[]): Macros {
  return items.reduce(
    (t, i) => ({
      calories: t.calories + i.calories,
      proteinG: t.proteinG + i.proteinG,
      carbsG: t.carbsG + i.carbsG,
      fatG: t.fatG + i.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

function trim(n: number) {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}
