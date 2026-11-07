import { Pressable, type PressableProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

type Props = PressableProps & {
  /** Styles the pressable surface (padding, background, border…). */
  className?: string;
  /** Layout of the outer wrapper in its parent (e.g. `flex-1` inside a row). */
  containerClassName?: string;
  scaleTo?: number;
};

/**
 * Pressable that shrinks slightly while pressed: feedback on press-in, per the expo-animation
 * skill (scale 0.97, 100–150 ms). The wrapper owns layout so `flex-1` etc. work in rows.
 */
export function PressableScale({ scaleTo = 0.97, className, containerClassName, ...props }: Props) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Animated.View style={animatedStyle} className={containerClassName}>
      <Pressable
        {...props}
        className={className}
        onPressIn={(e) => {
          scale.set(withTiming(scaleTo, { duration: 120 }));
          props.onPressIn?.(e);
        }}
        onPressOut={(e) => {
          scale.set(withTiming(1, { duration: 150 }));
          props.onPressOut?.(e);
        }}
      />
    </Animated.View>
  );
}
