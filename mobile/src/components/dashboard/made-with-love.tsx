import { Heart } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '@/constants/colors';

const FADE_H = 170; // the soft black fade rising from the screen's bottom edge
const FADE_END = 0.22; // its opacity at the very bottom
/** Painted below the content so iOS's bottom bounce shows the fade's colour, not a blank strip. */
const OVERSCROLL_H = 1000;

/**
 * The light is three nested windows over a coral copy of the words: wide and faint outside,
 * narrow and solid in the middle, which reads as a soft glow. Plain views (no SVG clip paths),
 * so it looks the same on iOS and Android.
 */
const GLOW = [
  { width: 56, opacity: 0.3 },
  { width: 30, opacity: 0.55 },
  { width: 12, opacity: 1 },
];
const SWEEP_MS = 1800;
const REST_MS = 2800;
const EASE = Easing.bezier(0.45, 0, 0.55, 1);
const WORDS = 'Made with';

function Words({ color }: { color: string }) {
  return (
    <Text
      numberOfLines={1}
      style={{ fontFamily: 'Lora_600SemiBold', fontSize: 24, lineHeight: 32, color }}
    >
      {WORDS}
    </Text>
  );
}

/** One glow window: slides with the light while its coral words stay put under the base words. */
function GlowWindow({
  x,
  width,
  opacity,
  wordsWidth,
}: {
  x: SharedValue<number>;
  width: number;
  opacity: number;
  /** The coral copy gets the full words' width, or it would wrap inside the narrow window. */
  wordsWidth: number;
}) {
  const windowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() - width / 2 }],
  }));
  const wordsStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -(x.get() - width / 2) }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', top: 0, bottom: 0, left: 0, width, overflow: 'hidden', opacity },
        windowStyle,
      ]}
    >
      <Animated.View
        style={[{ position: 'absolute', top: 0, left: 0, width: wordsWidth }, wordsStyle]}
      >
        <Words color={colors.accent} />
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Dashboard sign-off at the very bottom: a light black fade rising from the screen edge, and
 * "Made with ♥" in ink with a warm light sweeping through the words; the heart beats as the
 * light reaches it. Static when reduced motion is on.
 *
 * `bleed` = the parent's horizontal and bottom padding, so the fade reaches the screen edges.
 */
export function MadeWithLove({ bleed }: { bleed: { x: number; bottom: number } }) {
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [wordsW, setWordsW] = useState(0);
  const x = useSharedValue(-100);
  const beat = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion || !wordsW) return;
    const start = -GLOW[0]!.width;
    const end = wordsW + GLOW[0]!.width;
    // Cross the words, rest, jump back off the words (invisible) and repeat.
    x.set(start);
    x.set(
      withRepeat(
        withSequence(
          withTiming(end, { duration: SWEEP_MS, easing: EASE }),
          withDelay(REST_MS, withTiming(start, { duration: 0 })),
        ),
        -1,
      ),
    );
    // Two beats as the light leaves the words, next to the heart.
    beat.set(
      withRepeat(
        withSequence(
          withDelay(SWEEP_MS - 350, withTiming(1.2, { duration: 160 })),
          withTiming(1, { duration: 160 }),
          withTiming(1.12, { duration: 140 }),
          withTiming(1, { duration: 240 }),
          withDelay(REST_MS - 350, withTiming(1, { duration: 0 })),
        ),
        -1,
      ),
    );
  }, [reduceMotion, wordsW, x, beat]);

  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: beat.get() }] }));

  return (
    <View
      style={{ marginHorizontal: -bleed.x, marginBottom: -bleed.bottom, height: FADE_H }}
      className="justify-end"
      accessible
      accessibilityRole="text"
      accessibilityLabel="Made with love"
    >
      <Svg width={width} height={FADE_H} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Defs>
          <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000" stopOpacity="0" />
            <Stop offset="1" stopColor="#000" stopOpacity={FADE_END} />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={FADE_H} fill="url(#fade)" />
      </Svg>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: FADE_H,
          left: 0,
          width,
          height: OVERSCROLL_H,
          backgroundColor: `rgba(0,0,0,${FADE_END})`,
        }}
      />

      <View
        className="flex-row items-center justify-center gap-2"
        style={{ paddingBottom: bleed.bottom + 28 }}
      >
        <View onLayout={(e) => setWordsW(Math.round(e.nativeEvent.layout.width))}>
          <Words color={colors.ink} />
          {!reduceMotion &&
            wordsW > 0 &&
            GLOW.map((g) => (
              <GlowWindow
                key={g.width}
                x={x}
                width={g.width}
                opacity={g.opacity}
                wordsWidth={wordsW}
              />
            ))}
        </View>
        <Animated.View style={heartStyle}>
          <Heart size={22} color={colors.accent} fill={colors.accent} />
        </Animated.View>
      </View>
    </View>
  );
}
