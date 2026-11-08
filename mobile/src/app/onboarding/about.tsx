import { View } from 'react-native';
import { StepScreen } from '@/components/onboarding/step-screen';
import { Stepper } from '@/components/ui/stepper';
import { ChoiceTile } from '@/components/ui/choice-tile';
import { Text } from '@/components/ui/text';
import { SEX_OPTIONS } from '@/constants/onboarding';
import { useOnboardingNav } from '@/hooks/use-onboarding-nav';
import { useOnboarding } from '@/store/onboarding';

export default function AboutStep() {
  const { draft, update } = useOnboarding();
  const { goNext } = useOnboardingNav('about');

  return (
    <StepScreen
      title="Let’s get to know you"
      subtitle="Your body and age shape how much energy you burn each day."
      canContinue={Boolean(draft.sex)}
      onContinue={goNext}
    >
      <Text className="font-sans-semibold">Which best describes you?</Text>
      <Text className="mb-3 mt-1 text-sm text-muted">
        Only used to estimate your calorie needs.
      </Text>
      <View className="flex-row gap-3" accessibilityRole="radiogroup">
        {SEX_OPTIONS.map((o) => (
          <ChoiceTile
            key={o.value}
            label={o.label}
            icon={o.icon}
            selected={draft.sex === o.value}
            onPress={() => update({ sex: o.value })}
          />
        ))}
      </View>

      <Text className="mb-3 mt-8 font-sans-semibold">How old are you?</Text>
      <Stepper
        label="Age"
        value={draft.age}
        min={13}
        max={100}
        unit="years"
        onChange={(age) => update({ age })}
      />
    </StepScreen>
  );
}
