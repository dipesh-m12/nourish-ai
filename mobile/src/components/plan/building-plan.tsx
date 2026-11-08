import LottieView from 'lottie-react-native';
import { CircleCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useScreenSize } from '@/hooks/use-screen-size';
import { Heading, Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { PLAN_STEPS, PLAN_TIPS } from '@/constants/plan-tips';
import { cn } from '@/lib/cn';

const STEP_MS = 1800;
const TIP_MS = 4000;
/** Space below the tip card, as a share of screen height. */
const TIP_LIFT = 0.25;

/**
 * Waiting screen while the AI writes the plan (~6–10s). Instead of a bare spinner it shows
 * what's happening (steps tick off) and something useful to read (rotating tips).
 * The last step stays "in progress" until the plan actually arrives.
 */
export function BuildingPlan({ name }: { name?: string }) {
  const [step, setStep] = useState(0);
  const [tip, setTip] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setStep((s) => Math.min(s + 1, PLAN_STEPS.length - 1)),
      STEP_MS,
    );
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTip((t) => (t + 1) % PLAN_TIPS.length), TIP_MS);
    return () => clearInterval(timer);
  }, []);

  const current = PLAN_TIPS[tip]!;
  const { height } = useScreenSize();

  // Heartbeat up top, progress just under it (towards the centre), and the tip card lifted
  // ~25% off the bottom edge so it sits in comfortable view rather than at the very bottom.
  return (
    <View
      className="flex-1 px-6 pt-6"
      style={{ paddingBottom: Math.round(height * TIP_LIFT) }}
      accessibilityLiveRegion="polite"
    >
      <Heartbeat />
      <Heading className="mt-6 text-2xl">
        {name ? `Building your plan, ${name}…` : 'Building your plan…'}
      </Heading>

      <View className="mt-6 gap-3">
        {PLAN_STEPS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <View
              key={label}
              className={cn('flex-row items-center gap-3', i > step && 'opacity-40')}
            >
              {done ? (
                <CircleCheck size={20} color={colors.primary} />
              ) : active ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <View className="h-5 w-5 rounded-full border-2 border-line" />
              )}
              <Text className={cn('flex-1', done && 'text-muted')}>{label}</Text>
            </View>
          );
        })}
      </View>

      <View className="flex-1" />

      <View className="min-h-28 rounded-2xl bg-card p-5">
        <Text className="font-sans-semibold text-xs uppercase tracking-wider text-accent">
          {current.kind === 'tip' ? 'Did you know' : 'Keep in mind'}
        </Text>
        <Animated.View key={tip} entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)}>
          <Text
            className={cn('mt-2 leading-relaxed', current.kind === 'quote' && 'font-serif text-lg')}
          >
            {current.text}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

// Artwork is 800×388; height follows width so the line is never squashed.
const HEARTBEAT_ASPECT = 388 / 800;
/** Matches the screen's px-6 padding, so negative margins can bleed the line edge to edge. */
const SCREEN_GUTTER = 24;

/**
 * Full-width looping heartbeat line (Lottie, recoloured to the app palette):
 * "your plan is coming to life". With reduced motion on, it shows a still frame instead.
 */
function Heartbeat() {
  const reduceMotion = useReducedMotion();
  const { width } = useScreenSize();

  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      style={{ marginHorizontal: -SCREEN_GUTTER }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <LottieView
        source={require('@/assets/lottie/heartbeat.json')}
        autoPlay={!reduceMotion}
        loop={!reduceMotion}
        progress={reduceMotion ? 0.5 : undefined}
        style={{ width, height: Math.round(width * HEARTBEAT_ASPECT) }}
      />
    </Animated.View>
  );
}
