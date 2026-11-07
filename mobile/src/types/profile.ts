// Mirrors the API responses from server/src/services/profile.service.ts.

export type Sex = 'female' | 'male' | 'other';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type DietType = 'veg' | 'non_veg' | 'eggetarian' | 'vegan' | 'jain';
export type GoalType = 'lose_weight' | 'gain_muscle' | 'maintain' | 'eat_healthier';

export interface ProfileSummary {
  id: string;
  name: string;
  avatarColor: string;
  onboarded: boolean;
}

export interface Goal {
  id: string;
  type: GoalType;
  why: string;
  targetWeightKg: number | null;
  dailyCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface Profile extends ProfileSummary {
  sex: Sex | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: ActivityLevel | null;
  dietType: DietType | null;
  allergies: string[];
  goal: Goal | null;
}

export interface AuthResponse {
  profile: Profile;
  token: string;
}

export interface OnboardingPayload {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  dietType: DietType;
  allergies: string[];
  goal: { type: GoalType; targetWeightKg: number | null; why: string };
}
