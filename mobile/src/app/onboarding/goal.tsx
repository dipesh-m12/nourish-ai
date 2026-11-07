import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { StepScreen } from '@/components/onboarding/step-screen';
import { NumberField } from '@/components/ui/number-field';
import { OptionCard } from '@/components/ui/option-card';
import { FieldLabel } from '@/components/ui/field-label';
import { GOAL_OPTIONS } from '@/constants/onboarding';
import { useOnboardingNav } from '@/hooks/use-onboarding-nav';
import { useOnboarding } from '@/store/onboarding';
import type { GoalType } from '@/types/profile';
import { parseDecimal } from '@/utils/units';

/** Target weight only makes sense when the goal is to move the scale. */
const NEEDS_TARGET: GoalType[] = ['lose_weight', 'gain_muscle'];

function targetError(
  goal: GoalType | undefined,
  target: number | undefined,
  current: number | undefined,
) {
  if (!goal || target === undefined || current === undefined) return undefined;
  if (target < 25 || target > 300) return 'Enter between 25 and 300 kg';
  if (goal === 'lose_weight' && target >= current)
    return `Should be below your current ${current} kg`;
  if (goal === 'gain_muscle' && target <= current)
    return `Should be above your current ${current} kg`;
  return undefined;
}

export default function GoalStep() {
  const { draft, update } = useOnboarding();
  const { goNext } = useOnboardingNav('goal');
  const [targetText, setTargetText] = useState(
    draft.targetWeightKg ? String(draft.targetWeightKg) : '',
  );

  const needsTarget = draft.goalType ? NEEDS_TARGET.includes(draft.goalType) : false;
  const target = parseDecimal(targetText);
  const error = needsTarget ? targetError(draft.goalType, target, draft.weightKg) : undefined;
  // Target weight is optional — the plan works without it — but must be sensible if entered.
  const canContinue = Boolean(draft.goalType) && !error;

  return (
    <StepScreen
      title="What do you want to achieve?"
      subtitle="Pick the one that matters most right now. You can change it later."
      canContinue={canContinue}
      onContinue={() => {
        update({ targetWeightKg: needsTarget && target ? Math.round(target * 10) / 10 : null });
        goNext();
      }}
    >
      <View className="gap-3" accessibilityRole="radiogroup">
        {GOAL_OPTIONS.map((o) => (
          <OptionCard
            key={o.value}
            label={o.label}
            hint={o.hint}
            icon={o.icon}
            selected={draft.goalType === o.value}
            onPress={() => update({ goalType: o.value })}
          />
        ))}
      </View>

      {needsTarget && (
        <Animated.View
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
          className="mt-8"
        >
          <FieldLabel optional>Target weight</FieldLabel>
          {/* Placeholder shows the current weight, so no extra "you're at…" line is needed. */}
          <NumberField
            value={targetText}
            onChangeText={setTargetText}
            unit="kg"
            placeholder={String(draft.weightKg ?? 70)}
            accessibilityLabel="Target weight in kilograms"
            error={error}
            allowDecimal
          />
        </Animated.View>
      )}
    </StepScreen>
  );
}
