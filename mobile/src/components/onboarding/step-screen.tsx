import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Heading, Text } from '@/components/ui/text';

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  canContinue: boolean;
  onContinue: () => void;
  continueLabel?: string;
}

/**
 * Shared layout for every onboarding question: title, answers, sticky Continue button.
 * The parent onboarding layout handles the keyboard, so the button stays visible above it.
 */
export function StepScreen({
  title,
  subtitle,
  children,
  canContinue,
  onContinue,
  continueLabel = 'Continue',
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-bg">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pb-6 pt-4"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <Heading>{title}</Heading>
          {/* The subtitle introduces the field below, so it sits closer to the field than to the title. */}
          {subtitle && <Text className="mt-4 text-muted">{subtitle}</Text>}
        </Animated.View>
        <Animated.View
          entering={FadeInDown.delay(120).duration(400)}
          className={subtitle ? 'mt-3' : 'mt-6'}
        >
          {children}
        </Animated.View>
      </ScrollView>

      <View className="px-6 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
        <Button label={continueLabel} onPress={onContinue} disabled={!canContinue} />
      </View>
    </View>
  );
}
