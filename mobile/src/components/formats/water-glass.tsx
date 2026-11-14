import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

export const GLASS_W = 150;
export const GLASS_H = 190;
const TOP_INSET = 8; // glass wall at the rim
const BOTTOM_INSET = 22; // narrower at the base: a tumbler, not a box
const RIM = 14; // headroom above the "full" line
const BASE = 12; // thick glass base

/** Tumbler outline: wide rim, tapered sides, rounded base. */
const GLASS = `M ${TOP_INSET} 4 L ${BOTTOM_INSET} ${GLASS_H - 10} Q ${BOTTOM_INSET + 2} ${GLASS_H - 2} ${BOTTOM_INSET + 12} ${GLASS_H - 2} L ${GLASS_W - BOTTOM_INSET - 12} ${GLASS_H - 2} Q ${GLASS_W - BOTTOM_INSET - 2} ${GLASS_H - 2} ${GLASS_W - BOTTOM_INSET} ${GLASS_H - 10} L ${GLASS_W - TOP_INSET} 4 Z`;

const EMPTY_Y = GLASS_H - BASE;
const FULL_Y = RIM;

interface Props {
  /** 0–1: share of today's goal drunk so far. The glass stays at this level. */
  level: number;
  /** Bumps on every pour, to play the stream and the splash. */
  pours: number;
}

/**
 * A glass that holds today's progress: the water sits at the share of the goal already drunk,
 * its surface gently waves, and each pour drops a stream in, rippling the surface as it rises.
 */
export function WaterGlass({ level, pours }: Props) {
  const reduceMotion = useReducedMotion();
  const fill = useSharedValue(level);
  const phase = useSharedValue(0);
  const wobble = useSharedValue(0.25); // wave height: calm at rest, choppy after a pour
  const stream = useSharedValue(0);

  // Rise to the new level like real water: a little overshoot, then settle.
  useEffect(() => {
    const to = Math.min(Math.max(level, 0), 1);
    fill.set(reduceMotion ? to : withSpring(to, { damping: 14, stiffness: 70 }));
  }, [level, fill, reduceMotion]);

  // The surface never stops moving (slowly), unless motion is reduced.
  useEffect(() => {
    if (reduceMotion) return;
    phase.set(withRepeat(withTiming(Math.PI * 2, { duration: 2400, easing: Easing.linear }), -1));
  }, [phase, reduceMotion]);

  // Each pour: a stream falls for a moment and the surface gets choppy, then calms.
  useEffect(() => {
    if (!pours || reduceMotion) return;
    stream.set(
      withSequence(
        withTiming(1, { duration: 140 }),
        withTiming(1, { duration: 260 }),
        withTiming(0, { duration: 180 }),
      ),
    );
    wobble.set(
      withSequence(withTiming(1, { duration: 200 }), withTiming(0.25, { duration: 1400 })),
    );
  }, [pours, stream, wobble, reduceMotion]);

  const waterProps = useAnimatedProps(() => {
    const y = EMPTY_Y - (EMPTY_Y - FULL_Y) * fill.get();
    const amp = fill.get() <= 0.001 ? 0 : 3 * wobble.get();
    // A sine surface across the glass, closed down to the bottom (the clip shapes the sides).
    let d = `M 0 ${y}`;
    for (let x = 0; x <= GLASS_W; x += 10) {
      d += ` L ${x} ${y + Math.sin(x / 18 + phase.get()) * amp}`;
    }
    return { d: `${d} L ${GLASS_W} ${GLASS_H} L 0 ${GLASS_H} Z` };
  });

  const streamProps = useAnimatedProps(() => {
    const surface = EMPTY_Y - (EMPTY_Y - FULL_Y) * fill.get();
    return { height: Math.max(0, (surface + 4) * stream.get()), opacity: stream.get() };
  });

  return (
    <Svg width={GLASS_W} height={GLASS_H}>
      <Defs>
        <ClipPath id="glass-inside">
          <Path d={GLASS} />
        </ClipPath>
        <LinearGradient id="water" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#B9DCEB" />
          <Stop offset="1" stopColor="#7FB8D4" />
        </LinearGradient>
      </Defs>
      <Path d={GLASS} fill="#F3F8FA" />
      <AnimatedRect
        x={GLASS_W / 2 - 4}
        y={0}
        width={8}
        rx={4}
        fill="#9FCBE0"
        clipPath="url(#glass-inside)"
        animatedProps={streamProps}
      />
      <AnimatedPath fill="url(#water)" clipPath="url(#glass-inside)" animatedProps={waterProps} />
      {/* Glass wall and a soft highlight down the left side. */}
      <Path d={GLASS} fill="none" stroke="#1C2321" strokeWidth={4} strokeLinejoin="round" />
      <Path
        d={`M ${TOP_INSET + 12} 18 L ${BOTTOM_INSET + 8} ${GLASS_H - 40}`}
        stroke="#FFFFFF"
        strokeOpacity={0.7}
        strokeWidth={5}
        strokeLinecap="round"
      />
    </Svg>
  );
}
