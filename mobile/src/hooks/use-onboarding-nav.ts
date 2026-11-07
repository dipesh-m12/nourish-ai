import { router } from 'expo-router';
import { ONBOARDING_STEPS, type OnboardingStep } from '@/constants/onboarding';

/** Moves to the step after `current`; after the last question, to the plan reveal. */
export function useOnboardingNav(current: OnboardingStep) {
  const index = ONBOARDING_STEPS.indexOf(current);
  const next = ONBOARDING_STEPS[index + 1];

  return {
    goNext: () => router.push(next ? `/onboarding/${next}` : '/onboarding/plan'),
  };
}
