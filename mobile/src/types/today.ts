// Mirrors server/src/services/challenges/challenge-progress.service.ts → today().
import type { Burn } from './burn';
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
  /** 'meal' = food challenge: logging goes through the meal flow so calories update too. */
  logsVia: 'meal' | 'proof';
  progress: {
    value: number;
    goal: number;
    done: boolean;
    /** First day this challenge counted (local date). */
    startedOn: string;
    /** Last 28 days, oldest first. `active` = on or after startedOn. */
    history: { date: string; value: number; active: boolean }[];
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
  challenges: TodayChallenge[];
}

export type LogResult =
  | {
      verified: true;
      note: string;
      amount: number;
      meal?: { calories: number };
      /** Set for movement/sleep challenges: the burn this log added. */
      burned?: { kind: string; calories: number } | null;
    }
  | { verified: false; note: string };
