import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  FadeInRight,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { AgentLottie } from './agent-lottie';

const IDLE_MS = 3800;
const EASE = Easing.inOut(Easing.sin);

/**
 * "Ask Nourish" hangs off the right edge like a price tag: a punched hole, the assistant's face,
 * a label. Every few seconds it flutters as if caught by a breeze, enough to be noticed, not
 * enough to nag. Still on reduced motion.
 */
export function AskNourishTag({ bottom }: { bottom: number }) {
  const reduceMotion = useReducedMotion();
  const swing = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    // A damped swing (−6°, +4°, −2°, 0) then a long rest, on repeat.
    swing.set(
      withRepeat(
        withSequence(
          withDelay(IDLE_MS, withTiming(-6, { duration: 180, easing: EASE })),
          withTiming(4, { duration: 200, easing: EASE }),
          withTiming(-2, { duration: 180, easing: EASE }),
          withTiming(0, { duration: 160, easing: EASE }),
        ),
        -1,
      ),
    );
  }, [reduceMotion, swing]);

  // Pivot near the hole (the right end, where the tag "hangs" from the edge).
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${swing.get()}deg` }],
    transformOrigin: 'right center',
  }));

  return (
    <Animated.View
      entering={FadeInRight.duration(450).delay(200)}
      className="absolute right-0"
      style={{ bottom }}
    >
      <Animated.View style={style}>
        <PressableScale
          onPress={() => {
            Haptics.selectionAsync();
            router.push('/assistant');
          }}
          accessibilityRole="button"
          accessibilityLabel="Ask Nourish, your assistant"
          className="flex-row items-center gap-2 rounded-l-full bg-ink py-1.5 pl-1.5 pr-4 shadow-lg"
          style={{ elevation: 6 }}
        >
          <AgentLottie size={40} round />
          <Text className="font-sans-semibold text-sm text-white">Ask Nourish</Text>
          {/* The tag's punched hole. */}
          <View className="ml-1 h-2 w-2 rounded-full bg-bg" />
        </PressableScale>
      </Animated.View>
    </Animated.View>
  );
}
