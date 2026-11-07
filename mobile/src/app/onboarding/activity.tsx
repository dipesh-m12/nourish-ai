import { View } from 'react-native';
import { StepScreen } from '@/components/onboarding/step-screen';
import { OptionCard } from '@/components/ui/option-card';
import { ACTIVITY_OPTIONS } from '@/constants/onboarding';
import { useOnboardingNav } from '@/hooks/use-onboarding-nav';
import { useOnboarding } from '@/store/onboarding';

export default function ActivityStep() {
  const { draft, update } = useOnboarding();
  const { goNext } = useOnboardingNav('activity');

  return (
    <StepScreen
      title="How active is a normal week?"
      subtitle="Be honest. A realistic answer makes a plan you can actually stick to."
      canContinue={Boolean(draft.activityLevel)}
      onContinue={goNext}
    >
      <View className="gap-3" accessibilityRole="radiogroup">
        {ACTIVITY_OPTIONS.map((o) => (
          <OptionCard
            key={o.value}
            label={o.label}
            hint={o.hint}
            icon={o.icon}
            selected={draft.activityLevel === o.value}
            onPress={() => update({ activityLevel: o.value })}
          />
        ))}
      </View>
    </StepScreen>
  );
}
