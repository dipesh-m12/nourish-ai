import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/constants/colors';

const SIZE = 26;
const EASE = Easing.bezier(0.23, 1, 0.32, 1);

/** One ring that grows and fades, like the spread of a fingertip on glass. */
function Ring({ delay }: { delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withDelay(delay, withRepeat(withTiming(1, { duration: 1600, easing: EASE }), -1)));
  }, [delay, t]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - t.get()),
    transform: [{ scale: 0.4 + t.get() * 0.8 }],
  }));
  return <Animated.View style={[styles.ring, style]} />;
}

/**
 * "You can tap this": two soft ink rings pulsing out of a hollow fingertip ring, like a tap.
 * Decorative only (the card itself carries the label). Reduced motion: the rings stand still.
 */
export function TapHint() {
  const reduceMotion = useReducedMotion();
  return (
    <View style={styles.box} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      {reduceMotion ? (
        <View style={[styles.ring, { opacity: 0.3 }]} />
      ) : (
        <>
          <Ring delay={0} />
          <Ring delay={500} />
        </>
      )}
      {/* The fingertip: a still ring, hollow (no filled dot). */}
      <View style={styles.tip} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  tip: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.ink,
    opacity: 0.55,
  },
});
