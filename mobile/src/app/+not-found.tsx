import { router, usePathname } from 'expo-router';
import { Compass } from 'lucide-react-native';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Heading, Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { RouteNotFoundError } from '@/lib/errors';
import { posthog } from '@/lib/posthog';

/**
 * Expo Router's catch-all for unknown routes. Reports the bad path to PostHog error tracking
 * so broken links show up in monitoring, then offers one clear way back.
 */
export default function NotFoundScreen() {
  const pathname = usePathname();

  useEffect(() => {
    const error = new RouteNotFoundError(pathname);
    posthog?.captureException(error, { pathname });
    if (__DEV__) console.warn(error.message);
  }, [pathname]);

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-bg px-8">
      <LostCompass />

      <View className="mt-8 flex-row" accessibilityLabel="404">
        {['4', '0', '4'].map((digit, i) => (
          <Animated.View
            key={i}
            // Staggered 50 ms, 200 ms each: all three digits land within 0.3 s.
            entering={FadeInDown.delay(i * 50)
              .duration(200)
              .easing(Easing.bezier(0.23, 1, 0.32, 1))}
          >
            <Text className="font-serif-bold text-6xl text-primary">{digit}</Text>
          </Animated.View>
        ))}
      </View>

      <Animated.View entering={FadeInDown.delay(500).duration(400)} className="items-center">
        <Heading className="mt-2 text-center text-xl" numberOfLines={1} adjustsFontSizeToFit>
          You weren’t supposed to come here
        </Heading>
        <Text
          className="mt-1 text-center text-sm text-muted"
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          This page wandered off. Let’s get you home.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(650).duration(400)} className="mt-8 self-stretch">
        {/* Index decides the right home: dashboard if signed in, the picker if not. */}
        <Button label="Take me home" onPress={() => router.replace('/')} />
      </Animated.View>
    </SafeAreaView>
  );
}

/** A compass that keeps searching for the way: swings, overshoots, settles, repeats. */
function LostCompass() {
  const reduceMotion = useReducedMotion();
  const angle = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    const swing = (to: number, duration: number) =>
      withTiming(to, { duration, easing: Easing.inOut(Easing.quad) });
    angle.set(
      withRepeat(
        withSequence(
          swing(-28, 500),
          swing(22, 600),
          swing(-10, 450),
          swing(0, 400),
          swing(0, 900),
        ),
        -1,
      ),
    );
  }, [angle, reduceMotion]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.get()}deg` }] }));

  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      className="h-24 w-24 items-center justify-center rounded-full bg-primary-soft"
    >
      <Animated.View style={style}>
        <Compass size={44} color={colors.primary} strokeWidth={1.75} />
      </Animated.View>
    </Animated.View>
  );
}
