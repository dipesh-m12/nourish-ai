import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  ZoomIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useLogProgress } from '@/api/today';
import { fmt } from '@/components/dashboard/challenge-widgets';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import type { TodayChallenge } from '@/types/today';

/** Taps within this window go to the server as one log. */
const BATCH_MS = 700;
const MARK_H = 44;

interface Props {
  challenge: TodayChallenge;
  date: string;
  onError: (message: string) => void;
}

/**
 * Counting habits (sets, servings, pages, rounds) as tally marks: every tap draws a stroke,
 * the fifth slashes across the four, like counting on paper. Big target, one thumb.
 */
export function TallyLog({ challenge, date, onError }: Props) {
  const log = useLogProgress(date);
  const reduceMotion = useReducedMotion();
  const { unit } = challenge.tracking;
  const goal = challenge.progress.goal;
  const [added, setAdded] = useState(0);
  const pending = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const count = Math.round(challenge.progress.value + added);
  const press = useSharedValue(1);

  const flush = () => {
    timer.current = null;
    const amount = pending.current;
    pending.current = 0;
    if (amount <= 0) return;
    log.mutate(
      { challengeId: challenge.id, amount },
      {
        onError: (err) => {
          setAdded((a) => a - amount);
          onError(err.message);
        },
      },
    );
  };

  // Closing mid-batch still saves the taps.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        flush();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const tap = () => {
    const next = count + 1;
    Haptics.impactAsync(
      next % 5 === 0 ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light,
    );
    if (next === goal) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAdded((a) => a + 1);
    pending.current += 1;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, BATCH_MS);
    if (!reduceMotion)
      press.set(withSequence(withTiming(0.92, { duration: 70 }), withSpring(1, { damping: 8 })));
  };

  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.get() }] }));
  const groups = Array.from({ length: Math.ceil(Math.max(count, 1) / 5) }, (_, g) =>
    Math.min(5, count - g * 5),
  );

  return (
    <View className="items-center">
      {/* The marks, in groups of five. Empty state shows one faint group to fill. */}
      <View
        className="min-h-24 flex-row flex-wrap justify-center gap-5 py-3"
        accessible
        accessibilityLabel={`${count} of ${fmt(goal)}${unit ? ` ${unit}` : ''}`}
      >
        {groups.map((n, g) => (
          <TallyGroup key={g} marks={Math.max(n, 0)} animate={!reduceMotion} />
        ))}
      </View>

      <Text className="mt-1 text-muted">
        {count} / {fmt(goal)}
        {unit ? ` ${unit}` : ''}
      </Text>

      <Animated.View style={pressStyle} className="mt-6">
        <Pressable
          onPress={tap}
          accessibilityRole="button"
          accessibilityLabel={`Add one${unit ? ` ${unit.replace(/s$/, '')}` : ''}`}
          className="h-36 w-36 items-center justify-center rounded-full bg-ink"
        >
          <Text className="font-serif-bold text-5xl text-white">+1</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/** Four upright strokes, then a fifth slashing across them. */
function TallyGroup({ marks, animate }: { marks: number; animate: boolean }) {
  return (
    <View style={{ width: 64, height: MARK_H }} className="flex-row items-end justify-between px-1">
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ width: 6, height: MARK_H }} className="justify-end">
          {i < marks ? (
            <Animated.View
              entering={animate ? ZoomIn.duration(180).easing(Easing.out(Easing.cubic)) : undefined}
              className="rounded-full bg-ink"
              style={{ width: 6, height: MARK_H }}
            />
          ) : (
            <View className="rounded-full bg-line" style={{ width: 6, height: MARK_H }} />
          )}
        </View>
      ))}
      {marks >= 5 && (
        <Animated.View
          entering={animate ? ZoomIn.duration(220) : undefined}
          className="absolute rounded-full"
          style={{
            left: -4,
            top: MARK_H / 2 - 3,
            width: 72,
            height: 6,
            backgroundColor: colors.accent,
            transform: [{ rotate: '-24deg' }],
          }}
        />
      )}
    </View>
  );
}
