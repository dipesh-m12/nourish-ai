import { useEffect } from 'react';
import { View, type ViewProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/**
 * Soft pulsing group for loading placeholders. One animation drives all
 * children, so blocks pulse in sync. Static when the user prefers reduced motion.
 */
export function SkeletonGroup({ children, ...props }: ViewProps & { className?: string }) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!reduceMotion) opacity.set(withRepeat(withTiming(0.45, { duration: 800 }), -1, true));
  }, [opacity, reduceMotion]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View style={style} {...props}>
      {children}
    </Animated.View>
  );
}

/** A single placeholder block. Size and shape come from className. */
export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <View className={`rounded-lg bg-line ${className}`} />;
}
