// Mirrors server/src/services/plan/plan.service.ts → toPlanView.
import type { GoalType } from './profile';

export type BmiCategory = 'underweight' | 'healthy' | 'overweight' | 'obese';
export type ChallengeFrequency = 'daily' | 'weekly';
export type ChallengeCategory = 'movement' | 'nutrition' | 'hydration' | 'sleep' | 'mindset';

export interface Challenge {
  id: string;
  title: string;
  target: string;
  why: string;
  frequency: ChallengeFrequency;
  category: ChallengeCategory;
  accepted: boolean;
  endsOn: string | null;
  /** 'plan' = suggested at onboarding, 'user' = asked for. */
  source: 'plan' | 'user';
}

/** One AI proposal from "What do you want to achieve?" (not saved yet). */
export interface ChallengeProposal {
  title: string;
  target: string;
  /** How it will feel, not a number. */
  why: string;
  frequency: ChallengeFrequency;
  category: ChallengeCategory;
  endsOn: string | null;
  /** The user didn't say how long: the app asks. */
  ask: boolean;
}

export interface Plan {
  metrics: {
    bmi: number;
    bmiCategory: BmiCategory;
    startWeightKg: number;
    targetWeightKg: number | null;
    estimatedWeeks: number | null;
    dailyCalories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
  goal: { type: GoalType; why: string };
  summary: string;
  encouragement: string;
  focusHabits: { title: string; why: string }[];
  sampleDay: { slot: 'breakfast' | 'lunch' | 'snack' | 'dinner'; meal: string; kcal: number }[];
  challenges: Challenge[];
  /** 'gemini' | 'groq' | 'template' */
  source: string;
}
