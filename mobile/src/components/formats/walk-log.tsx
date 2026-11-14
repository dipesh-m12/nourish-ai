import * as Haptics from 'expo-haptics';
import { ChevronLeft, Footprints } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { AmountPicker } from '@/components/dashboard/amount-picker';
import { fmt } from '@/components/dashboard/challenge-widgets';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import type { TodayChallenge } from '@/types/today';

interface Props {
  challenge: TodayChallenge;
  pending: boolean;
  error: string | null;
  onStart: () => void;
  onLog: (amount: number) => void;
}

/**
 * The walk sheet does one thing: start a walk. Logging one done earlier hides behind a small
 * "Already walked?" link, and then it's one tap per amount (no stepper unless asked for).
 */
export function WalkLog({ challenge, pending, error, onStart, onLog }: Props) {
  const [mode, setMode] = useState<'go' | 'done'>('go');
  const { unit } = challenge.tracking;
  const left = Math.max(0, challenge.progress.goal - challenge.progress.value);
  const u = unit ? ` ${unit}` : '';

  if (mode === 'done') {
    return (
      <DoneEarlier
        challenge={challenge}
        left={left}
        pending={pending}
        error={error}
        onLog={onLog}
        onBack={() => setMode('go')}
      />
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(220)} className="items-center pb-2 pt-2">
      <StartButton onPress={onStart} />
      <Text className="mt-4 font-sans-semibold text-lg">
        {left > 0 ? `${fmt(left)}${u} to go` : 'Goal done. Walk anyway?'}
      </Text>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          setMode('done');
        }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Already walked? Log it"
        className="mt-5 h-11 justify-center px-4"
      >
        <Text className="font-sans-semibold text-primary">Already walked?</Text>
      </Pressable>
    </Animated.View>
  );
}

const SIZE = 148;

/** One big round button: a soft ring breathes out from it and the footprints bob, like setting off. */
function StartButton({ onPress }: { onPress: () => void }) {
  const still = useReducedMotion();
  const bob = useSharedValue(0);
  const ring = useSharedValue(0);

  useEffect(() => {
    if (still) return;
    bob.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 500, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 500, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
      ),
    );
    ring.set(withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1));
  }, [still, bob, ring]);

  const feet = useAnimatedStyle(() => ({ transform: [{ translateY: -5 * bob.get() }] }));
  const halo = useAnimatedStyle(() => ({
    opacity: 0.3 * (1 - ring.get()),
    transform: [{ scale: 1 + 0.3 * ring.get() }],
  }));

  // Sizes are explicit styles: class-based sizes on a pressable inside a sheet came out oval.
  const circle = { width: SIZE, height: SIZE, borderRadius: SIZE / 2 };

  return (
    <View
      className="items-center justify-center"
      style={{ width: SIZE * 1.35, height: SIZE * 1.35 }}
    >
      <Animated.View
        pointerEvents="none"
        style={[circle, { position: 'absolute', backgroundColor: colors.primary }, halo]}
      />
      <PressableScale
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel="Start walk"
      >
        <View
          className="items-center justify-center"
          style={[circle, { backgroundColor: colors.primary }]}
        >
          <Animated.View style={feet}>
            <Footprints size={34} color="#fff" />
          </Animated.View>
          <Text className="mt-1 font-sans-semibold text-lg text-white">Start</Text>
        </View>
      </PressableScale>
    </View>
  );
}

/** Walked already: big one-tap amounts; "Other" opens the stepper. */
function DoneEarlier({
  challenge,
  left,
  pending,
  error,
  onLog,
  onBack,
}: {
  challenge: TodayChallenge;
  left: number;
  pending: boolean;
  error: string | null;
  onLog: (amount: number) => void;
  onBack: () => void;
}) {
  const { step, target, unit } = challenge.tracking;
  const [custom, setCustom] = useState<number | null>(null);
  const u = unit ? ` ${unit}` : '';
  // Typical walks, then "all of it": never more than what's left of the goal.
  const picks = [
    ...new Set(
      [step * 2, step * 4, left].filter((v) => v > 0 && v <= Math.max(left, step) && v <= target),
    ),
  ].slice(0, 3);

  return (
    <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(120)}>
      <Pressable
        onPress={onBack}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Back"
        className="-ml-1 mb-3 h-9 flex-row items-center self-start"
      >
        <ChevronLeft size={18} color={colors.muted} />
        <Text className="text-muted">How long did you walk?</Text>
      </Pressable>

      {custom === null ? (
        <View className="flex-row gap-3">
          {picks.map((v) => (
            <PressableScale
              key={v}
              disabled={pending}
              onPress={() => {
                Haptics.selectionAsync();
                onLog(v);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Log ${fmt(v)}${u}`}
              containerClassName="flex-1"
              className="h-24 items-center justify-center rounded-2xl bg-primary-soft"
            >
              <Text className="font-serif-bold text-3xl text-primary">{fmt(v)}</Text>
              <Text className="text-sm text-muted">{v === left ? `all${u}` : (unit ?? '')}</Text>
            </PressableScale>
          ))}
          <PressableScale
            onPress={() => setCustom(picks[0] ?? step)}
            accessibilityRole="button"
            accessibilityLabel="Other amount"
            containerClassName="flex-1"
            className="h-24 items-center justify-center rounded-2xl border border-line bg-card"
          >
            <Text className="font-sans-semibold text-ink">Other</Text>
          </PressableScale>
        </View>
      ) : (
        <View>
          <AmountPicker challenge={challenge} value={custom} onChange={setCustom} />
          <Button className="mt-5" label="Log it" loading={pending} onPress={() => onLog(custom)} />
        </View>
      )}
      {error && <Text className="mt-3 text-sm text-danger">{error}</Text>}
    </Animated.View>
  );
}
