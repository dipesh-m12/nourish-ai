import { type ReactNode, useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '@/constants/colors';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

interface Props {
  /** 0–1; values above 1 are drawn as a full ring. */
  progress: number;
  size: number;
  stroke: number;
  color?: string;
  /** Unfilled track: a lighter step of the same hue (dataviz skill: meter track). */
  trackColor?: string;
  children?: ReactNode;
}

/** Ring meter that animates to its new value whenever `progress` changes. */
export function ProgressRing({
  progress,
  size,
  stroke,
  color = colors.primary,
  trackColor = colors.primarySoft,
  children,
}: Props) {
  const reduceMotion = useReducedMotion();
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = useSharedValue(0);

  useEffect(() => {
    const target = Math.min(1, Math.max(0, progress));
    value.set(reduceMotion ? target : withTiming(target, { duration: 700, easing: EASE_OUT }));
  }, [progress, value, reduceMotion]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - value.get()),
  }));

  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg
        width={size}
        height={size}
        style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
        />
      </Svg>
      {children}
    </View>
  );
}
