import { router, Stack, usePathname } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { KeyboardAvoidingView, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProgressBar } from '@/components/onboarding/progress-bar';
import { colors } from '@/constants/colors';
import { ONBOARDING_STEPS, type OnboardingStep } from '@/constants/onboarding';

/**
 * One header (back + progress) shared by all steps, so only the content slides between steps.
 * Keyboard avoidance lives here, at the top of the screen, so its offset maths is exact and every
 * step's Continue button rides above the keyboard. "padding" on both platforms: Android is
 * edge-to-edge, so the OS no longer resizes the window for the keyboard.
 */
export default function OnboardingLayout() {
  const step = usePathname().split('/').pop() as OnboardingStep | 'plan';
  const isPlan = step === 'plan';
  const index = ONBOARDING_STEPS.indexOf(step as OnboardingStep);

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-bg">
      <SafeAreaView edges={['top']} className="flex-1 bg-bg">
        {!isPlan && (
          <View className="flex-row items-center gap-4 px-4 py-2">
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              className="h-10 w-10 items-center justify-center rounded-full bg-card"
            >
              <ChevronLeft size={22} color={colors.ink} />
            </Pressable>
            <ProgressBar progress={(index + 1) / ONBOARDING_STEPS.length} />
            <View className="w-10" />
          </View>
        )}
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="plan" options={{ animation: 'fade', gestureEnabled: false }} />
        </Stack>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
