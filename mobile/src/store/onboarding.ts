import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ActivityLevel, DietType, GoalType, OnboardingPayload, Sex } from '@/types/profile';

export interface OnboardingDraft {
  sex?: Sex;
  age: number;
  heightCm?: number;
  weightKg?: number;
  activityLevel?: ActivityLevel;
  dietType?: DietType;
  allergies: string[];
  goalType?: GoalType;
  targetWeightKg?: number | null;
  why: string;
}

const EMPTY_DRAFT: OnboardingDraft = { age: 25, allergies: [], why: '' };

interface OnboardingState {
  /** Which profile the draft belongs to, so switching profiles never mixes answers. */
  profileId: string | null;
  draft: OnboardingDraft;
  start: (profileId: string) => void;
  update: (patch: Partial<OnboardingDraft>) => void;
  reset: () => void;
}

// Persisted: if the app is closed mid-onboarding, answers are still there on return.
export const useOnboarding = create<OnboardingState>()(
  persist(
    (set, get) => ({
      profileId: null,
      draft: EMPTY_DRAFT,
      start: (profileId) => {
        if (get().profileId !== profileId) set({ profileId, draft: EMPTY_DRAFT });
      },
      update: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
      reset: () => set({ profileId: null, draft: EMPTY_DRAFT }),
    }),
    { name: 'onboarding-draft', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

/** Returns the API payload, or null if a required answer is still missing. */
export function toOnboardingPayload(d: OnboardingDraft): OnboardingPayload | null {
  if (!d.sex || !d.heightCm || !d.weightKg || !d.activityLevel || !d.dietType || !d.goalType) {
    return null;
  }
  return {
    sex: d.sex,
    age: d.age,
    heightCm: d.heightCm,
    weightKg: d.weightKg,
    activityLevel: d.activityLevel,
    dietType: d.dietType,
    allergies: d.allergies,
    goal: { type: d.goalType, targetWeightKg: d.targetWeightKg ?? null, why: d.why.trim() },
  };
}
