import LottieView from 'lottie-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

/**
 * One-shot celebration: confetti shoots up from the bottom, peaks, and drifts down (~4 s),
 * then removes itself. Full-screen overlay that never blocks touches.
 * Rare-moment delight only (expo-animation skill), and skipped entirely with reduced motion.
 * `onFinish` fires when it's over (immediately when skipped), so follow-ups can be sequenced.
 */
export function ConfettiBurst({ onFinish }: { onFinish?: () => void }) {
  const reduceMotion = useReducedMotion();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (reduceMotion) onFinish?.();
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
        source={require('@/assets/lottie/confetti.json')}
        autoPlay
        loop={false}
        resizeMode="cover"
        onAnimationFinish={() => {
          setDone(true);
          onFinish?.();
        }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
