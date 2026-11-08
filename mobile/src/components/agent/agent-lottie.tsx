import LottieView from 'lottie-react-native';
import { View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { cn } from '@/lib/cn';

/** The assistant's face: the yoga Lottie (recoloured to our palette). Still frame on reduced motion. */
const SOURCE = require('@/assets/lottie/nourish-yoga.json');

interface Props {
  size: number;
  /** Clip into a circle (tag, header, avatar) rather than show it full (intro sheet). */
  round?: boolean;
  className?: string;
}

export function AgentLottie({ size, round, className }: Props) {
  const reduceMotion = useReducedMotion();
  return (
    <View
      // LottieView has no pointerEvents prop, so the wrapper keeps taps going to the parent.
      pointerEvents="none"
      className={cn(
        round && 'items-center justify-center overflow-hidden rounded-full bg-primary-soft',
        className,
      )}
      style={{ width: size, height: size }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <LottieView
        source={SOURCE}
        autoPlay={!reduceMotion}
        loop={!reduceMotion}
        progress={reduceMotion ? 0.3 : undefined}
        // Inside a circle the figure is scaled up a touch so it fills the badge.
        style={{ width: round ? size * 1.25 : size, height: round ? size * 1.25 : size }}
      />
    </View>
  );
}
