import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { colors } from '@/constants/colors';

/** Must match app.json → expo-splash-screen, so the hand-off from the native splash is invisible. */
const SPLASH_BG = '#E1F1E6';
const TILE = 200;

// Curves from the expo-animation skill.
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

/** The same four-point spark as in the artwork, the "assistant noticed" hint. */
function Spark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 0C13 7 17 11 24 12C17 13 13 17 12 24C11 17 7 13 0 12C7 11 11 7 12 0Z"
        fill={colors.accent}
      />
    </Svg>
  );
}

/**
 * Takes over from the native splash with an identical frame, then the spark pops in and
 * the art zooms toward the viewer as the overlay fades to reveal the app.
 * ~1.1s total, runs once per cold start. Reduced motion: hold, then fade.
 */
export function AnimatedSplash({ onFinish }: { onFinish: () => void }) {
  const reduceMotion = useReducedMotion();
  const spark = useSharedValue(0);
  const zoom = useSharedValue(0);
  const fade = useSharedValue(1);

  // Safety net: if the image never reports onLoad, don't leave the native splash stuck on screen.
  useEffect(() => {
    const timer = setTimeout(() => SplashScreen.hideAsync(), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      spark.set(1);
      fade.set(
        withDelay(
          400,
          withTiming(0, { duration: 200 }, (done) => done && scheduleOnRN(onFinish)),
        ),
      );
      return;
    }
    spark.set(withDelay(150, withTiming(1, { duration: 350, easing: EASE_OUT })));
    zoom.set(withDelay(650, withTiming(1, { duration: 450, easing: EASE_IN_OUT })));
    fade.set(
      withDelay(
        700,
        withTiming(
          0,
          { duration: 400, easing: EASE_OUT },
          (done) => done && scheduleOnRN(onFinish),
        ),
      ),
    );
  }, [reduceMotion, spark, zoom, fade, onFinish]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: fade.get() }));
  const tileStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + zoom.get() * 1.6 }] }));
  const sparkStyle = useAnimatedStyle(() => ({
    opacity: spark.get(),
    transform: [{ scale: 0.9 + spark.get() * 0.1 }, { rotate: `${(1 - spark.get()) * -30}deg` }],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { backgroundColor: SPLASH_BG }, overlayStyle]}
      className="items-center justify-center"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={{ width: TILE, height: TILE }}>
        <Animated.View style={tileStyle}>
          <Image
            source={require('@/assets/images/splash-icon.png')}
            style={{ width: TILE, height: TILE }}
            // Hide the native splash only once our identical frame has painted, so there's no flash.
            onLoad={() => SplashScreen.hideAsync()}
            onError={() => SplashScreen.hideAsync()}
          />
        </Animated.View>
        <Animated.View style={[{ position: 'absolute', top: -34, right: -18 }, sparkStyle]}>
          <Spark size={36} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}
