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
  withTiming,
} from 'react-native-reanimated';

function Dot({ delay }: { delay: number }) {
  const reduceMotion = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    const ease = Easing.inOut(Easing.quad);
    y.set(
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(-4, { duration: 260, easing: ease }),
            withTiming(0, { duration: 260, easing: ease }),
            withTiming(0, { duration: 300 }),
          ),
          -1,
        ),
      ),
    );
  }, [delay, reduceMotion, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return <Animated.View style={style} className="h-2 w-2 rounded-full bg-muted/60" />;
}

/** "Nourish is thinking": three dots in a bubble, bouncing in turn. */
export function TypingDots() {
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      className="flex-row items-center gap-1.5 self-start rounded-2xl rounded-tl-md bg-card px-4 py-3.5"
      accessible
      accessibilityLabel="Nourish is typing"
    >
      {[0, 140, 280].map((d) => (
        <Dot key={d} delay={d} />
      ))}
    </Animated.View>
  );
}
