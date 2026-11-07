import { TextInput, View } from 'react-native';
import { StepScreen } from '@/components/onboarding/step-screen';
import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { WHY_SUGGESTIONS } from '@/constants/onboarding';
import { useOnboardingNav } from '@/hooks/use-onboarding-nav';
import { useOnboarding } from '@/store/onboarding';

const MIN_LENGTH = 3;
const MAX_LENGTH = 280;

/**
 * The most important question. A personal reason is what keeps people going;
 * the assistant quotes it back on the plan and in later nudges.
 */
export default function WhyStep() {
  const { draft, update } = useOnboarding();
  const { goNext } = useOnboardingNav('why');

  return (
    <StepScreen
      title="Why does this matter to you?"
      subtitle="In your own words. We'll remind you of this on the hard days."
      continueLabel="Build my plan"
      canContinue={draft.why.trim().length >= MIN_LENGTH}
      onContinue={goNext}
    >
      <TextInput
        value={draft.why}
        onChangeText={(why) => update({ why })}
        placeholder="I want to…"
        placeholderTextColor={colors.muted}
        multiline
        maxLength={MAX_LENGTH}
        textAlignVertical="top"
        accessibilityLabel="Your reason"
        className="min-h-32 rounded-2xl border-2 border-line bg-card p-4 font-sans text-lg leading-relaxed text-ink focus:border-primary"
      />
      <Text className="mt-1.5 self-end text-xs text-muted">
        {draft.why.length}/{MAX_LENGTH}
      </Text>

      <Text className="mb-3 mt-4 text-sm text-muted">Need a starting point?</Text>
      <View className="flex-row flex-wrap gap-2">
        {WHY_SUGGESTIONS.map((s) => (
          <Chip key={s} label={s} selected={draft.why === s} onPress={() => update({ why: s })} />
        ))}
      </View>
    </StepScreen>
  );
}
