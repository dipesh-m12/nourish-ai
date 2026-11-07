import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

/** Thin bar that glides to the new position whenever the step changes. */
export function ProgressBar({ progress }: { progress: number }) {
  const width = useSharedValue(progress);

  useEffect(() => {
    width.set(withTiming(progress, { duration: 450 }));
  }, [progress, width]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${width.get() * 100}%` }));

  return (
    <View
      className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
    >
      <Animated.View className="h-full rounded-full bg-primary" style={fillStyle} />
    </View>
  );
}
