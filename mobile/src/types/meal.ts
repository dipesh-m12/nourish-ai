// Mirrors server/src/services/meals/meal.service.ts.
import type { Macros } from './today';

export interface MealItem {
  name: string;
  portion: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** A challenge the meal counts toward (amount in the challenge's own unit). */
export interface MealCredit {
  challengeId: string;
  amount: number;
  label: string;
  unit: string | null;
}

export interface Meal extends Macros {
  id: string;
  title: string;
  items: MealItem[];
  comment: string | null;
  createdAt: string;
  photoKey: string | null;
  photoUrl: string | null;
}

export type MealAnalysis =
  | {
      isFood: true;
      title: string;
      items: MealItem[];
      totals: Macros;
      comment: string;
      credits: MealCredit[];
      /** Something breaks the diet/allergies: calories still count, challenges don't. */
      dietWarning: string | null;
      /** Per item: removing that item lifts its warning and restores challenge credit. */
      conflicts: { item: string; message: string }[];
    }
  | { isFood: false; comment: string };

export interface SavedMeal {
  meal: Meal;
  credits: MealCredit[];
}

export type EstimatedItem =
  { isFood: true; item: MealItem; dietWarning: string | null } | { isFood: false };

/** Voice results also carry what we heard, shown above the estimate. */
export type VoiceMealAnalysis = MealAnalysis & { transcript: string };
