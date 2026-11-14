import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const H = 160; // matches the photo's h-40
const CORNER = 22;

/**
 * Drawn over the meal photo while the AI reads it: four corner brackets and a glowing line
 * sweeping up and down, so the wait looks like scanning rather than a spinner.
 */
export function ScanOverlay() {
  const reduceMotion = useReducedMotion();
  const y = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    y.set(
      withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, true),
    );
  }, [y, reduceMotion]);

  const line = useAnimatedStyle(() => ({ transform: [{ translateY: 12 + y.get() * (H - 24) }] }));

  return (
    <View pointerEvents="none" className="absolute inset-0 overflow-hidden rounded-2xl bg-ink/15">
      {(['tl', 'tr', 'bl', 'br'] as const).map((k) => (
        <View
          key={k}
          className="absolute border-white"
          style={{
            width: CORNER,
            height: CORNER,
            top: k[0] === 't' ? 10 : undefined,
            bottom: k[0] === 'b' ? 10 : undefined,
            left: k[1] === 'l' ? 10 : undefined,
            right: k[1] === 'r' ? 10 : undefined,
            borderTopWidth: k[0] === 't' ? 3 : 0,
            borderBottomWidth: k[0] === 'b' ? 3 : 0,
            borderLeftWidth: k[1] === 'l' ? 3 : 0,
            borderRightWidth: k[1] === 'r' ? 3 : 0,
            borderRadius: 4,
          }}
        />
      ))}
      {!reduceMotion && (
        <Animated.View
          className="absolute inset-x-4 h-1 rounded-full bg-primary-soft"
          style={[
            line,
            { shadowColor: '#E6F2EB', shadowOpacity: 1, shadowRadius: 8, elevation: 6 },
          ]}
        />
      )}
    </View>
  );
}
