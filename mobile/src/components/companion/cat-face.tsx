import { Image } from 'expo-image';
import { useEffect } from 'react';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { CAT_FACES } from '@/constants/companion';
import type { CompanionMood } from '@/types/companion';

const EASE = Easing.inOut(Easing.quad);

/**
 * Mochi, showing her mood. A new mood crossfades in; happy gives a little hop every few
 * seconds, sad droops slightly, left is faded. Reduced motion: still faces only.
 */
export function CatFace({ mood, size }: { mood: CompanionMood; size: number }) {
  const reduceMotion = useReducedMotion();
  const hop = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || mood !== 'happy') {
      hop.set(withTiming(0, { duration: 200 }));
      return;
    }
    hop.set(
      withRepeat(
        withSequence(
          withDelay(2600, withTiming(-size * 0.08, { duration: 180, easing: EASE })),
          withSpring(0, { damping: 6, stiffness: 220 }),
        ),
        -1,
      ),
    );
  }, [hop, mood, reduceMotion, size]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: hop.get() }, { rotate: mood === 'sad' ? '-4deg' : '0deg' }],
    opacity: mood === 'left' ? 0.4 : 1,
  }));

  return (
    <Animated.View style={[style, { width: size, height: size }]}>
      {/* Keyed by mood, so a change fades the new face in. */}
      <Animated.View
        key={mood}
        entering={FadeIn.duration(350)}
        style={{ width: size, height: size }}
      >
        <Image
          source={CAT_FACES[mood]}
          style={{ width: size, height: size }}
          contentFit="contain"
          accessibilityIgnoresInvertColors
        />
      </Animated.View>
    </Animated.View>
  );
}
