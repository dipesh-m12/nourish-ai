import LottieView from 'lottie-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

/** Slightly longer than the animation (241 frames at 60 fps ≈ 4 s). */
const MAX_MS = 5000;

/**
 * One-shot celebration: confetti shoots up from the bottom, peaks, and drifts down (~4 s),
 * then removes itself. Full-screen overlay that never blocks touches.
 * Rare-moment delight only (expo-animation skill), and skipped entirely with reduced motion.
 * `onFinish` fires when it's over (immediately when skipped), so follow-ups can be sequenced.
 */
export function ConfettiBurst({ onFinish }: { onFinish?: () => void }) {
  const reduceMotion = useReducedMotion();
  const [done, setDone] = useState(false);
  const lottie = useRef<LottieView>(null);
  const started = useRef(false);

  const finish = () => {
    setDone(true);
    onFinish?.();
  };

  useEffect(() => {
    if (reduceMotion) {
      onFinish?.();
      return;
    }
    // Safety net: if the finish event never arrives, don't leave an invisible overlay behind.
    const timer = setTimeout(finish, MAX_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  if (reduceMotion || done) return null;

  return (
    // LottieView has no pointerEvents prop, so the wrapper lets taps pass through to the screen.
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <LottieView
        ref={lottie}
        source={require('@/assets/lottie/confetti.json')}
        // Started by hand once laid out: autoPlay can silently not start when the view mounts
        // during a screen transition (lottie-react-native 7, new architecture).
        autoPlay={false}
        loop={false}
        resizeMode="cover"
        onLayout={() => {
          if (started.current) return;
          started.current = true;
          lottie.current?.play();
        }}
        onAnimationFinish={(cancelled) => {
          if (!cancelled) finish();
        }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
