// Mirrors server/src/services/challenges/challenge-progress.service.ts → today().
import type { Burn } from './burn';
import type { Companion } from './companion';
import type { Meal } from './meal';
import type { ChallengeCategory, ChallengeFrequency } from './plan';

export type TrackingWidget = 'ring' | 'bars' | 'tally' | 'check';

export interface ChallengeTracking {
  kind: 'amount' | 'check';
  unit: string | null;
  target: number;
  step: number;
  widget: TrackingWidget;
  proof: string;
  /** 1–2 word card label, e.g. "Water". */
  label?: string;
}

export interface TodayChallenge {
  id: string;
  title: string;
  target: string;
  why: string;
  frequency: ChallengeFrequency;
  category: ChallengeCategory;
  tracking: ChallengeTracking;
  /** Last local day it runs (inclusive); null = ongoing. */
  endsOn: string | null;
  /** Daily reminder on the user's clock ("07:30"), or null. */
  remindAt: string | null;
  /** Pinned spot for "get there" challenges. */
  place: { lat: number; lng: number; radiusM: number } | null;
  /** A walk or timer still running (the app was closed mid-way): the card offers "Resume". */
  session: { id: string; kind: 'walk' | 'timer'; startedAt: string } | null;
  /** 'meal' = food challenge: logging goes through the meal flow so calories update too. */
  logsVia: 'meal' | 'proof';
  progress: {
    value: number;
    goal: number;
    done: boolean;
    /** First day this challenge counted (local date). */
    startedOn: string;
    /** Last 28 days, oldest first. `active` = on or after startedOn. */
    /** `goal` = that day's goal (a level-up starts the next day, so past days keep theirs). */
    history: { date: string; value: number; active: boolean; goal: number }[];
    streak: number;
    /** Past active days below target (daily challenges). */
    missed: number;
  };
}

export interface Macros {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface Today {
  date: string;
  targets: Macros | null;
  eaten: Macros;
  meals: Meal[];
  burn: Burn;
  companion: Companion;
  challenges: TodayChallenge[];
  /** Past their last day, waiting for "keep going" or "done". */
  ended: { id: string; title: string; endsOn: string }[];
}

export type LogResult =
  | {
      verified: true;
      /** AI note for food (meal) logs; null for plain logs. */
      note: string | null;
      amount: number;
      meal?: { calories: number };
      /** Set for movement/sleep challenges: the burn this log added. */
      burned?: { kind: string; calories: number } | null;
    }
  | { verified: false; note: string };
