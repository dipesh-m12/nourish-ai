import { Image } from 'expo-image';
import { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { cn } from '@/lib/cn';

const HOLD_MS = 900;
const FADE_MS = 450;
const EASE = Easing.inOut(Easing.cubic);

/**
 * The library has a start and an end photo per exercise. Crossfading between them reads as a
 * slow demonstration of the movement. With reduced motion it simply shows the start position.
 */
interface Props {
  images: string[];
  className?: string;
  /** Sizing (e.g. aspectRatio); the photos fill whatever box this gives. */
  style?: StyleProp<ViewStyle>;
}

export function ExerciseDemo({ images, className, style }: Props) {
  const reduceMotion = useReducedMotion();
  const end = useSharedValue(0);
  const animate = images.length > 1 && !reduceMotion;

  useEffect(() => {
    if (!animate) return;
    end.set(
      withRepeat(
        withSequence(
          withDelay(HOLD_MS, withTiming(1, { duration: FADE_MS, easing: EASE })),
          withDelay(HOLD_MS, withTiming(0, { duration: FADE_MS, easing: EASE })),
        ),
        -1,
      ),
    );
  }, [animate, end]);

  const endStyle = useAnimatedStyle(() => ({ opacity: end.get() }));

  return (
    <View
      className={cn('overflow-hidden bg-card', className)}
      style={style}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Exercise demonstration, start and end position"
    >
      {images[0] && (
        <Image
          source={{ uri: images[0] }}
          className="absolute inset-0"
          contentFit="cover"
          transition={200}
        />
      )}
      {animate && images[1] && (
        <Animated.View style={endStyle} className="absolute inset-0">
          <Image source={{ uri: images[1] }} className="h-full w-full" contentFit="cover" />
        </Animated.View>
      )}
    </View>
  );
}
