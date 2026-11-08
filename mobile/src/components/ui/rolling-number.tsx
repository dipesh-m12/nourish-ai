import { useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useReducedMotion,
  withTiming,
  type EntryAnimationsValues,
  type LayoutAnimation,
} from 'react-native-reanimated';
import { Text } from './text';

interface Props {
  value: number;
  format?: (value: number) => string;
  className?: string;
}

// Ease-out (expo-animation skill): settles fast, no bounce.
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const DURATION = 240;
const TRAVEL = 12;

/**
 * A number that rolls in from below when it goes up and from above when it goes down, like
 * an odometer. With reduced motion on, it simply changes.
 */
export function RollingNumber({ value, format = String, className }: Props) {
  const reduceMotion = useReducedMotion();
  // Derived during render (React's "store previous props" pattern), not in an effect.
  const [prev, setPrev] = useState(value);
  const [direction, setDirection] = useState<1 | -1>(1);
  if (prev !== value) {
    setDirection(value > prev ? 1 : -1);
    setPrev(value);
  }

  const from = direction * TRAVEL;
  const entering = (_: EntryAnimationsValues): LayoutAnimation => {
    'worklet';
    const timing = { duration: DURATION, easing: EASE_OUT };
    return {
      initialValues: { opacity: 0, transform: [{ translateY: from }] },
      animations: {
        opacity: withTiming(1, timing),
        transform: [{ translateY: withTiming(0, timing) }],
      },
    };
  };

  return (
    <View className="overflow-hidden">
      <Animated.View key={value} entering={reduceMotion ? undefined : entering}>
        <Text className={className}>{format(value)}</Text>
      </Animated.View>
    </View>
  );
}
