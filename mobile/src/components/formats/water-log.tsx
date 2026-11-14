import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useLogProgress } from '@/api/today';
import { fmt } from '@/components/dashboard/challenge-widgets';
import { RollingNumber } from '@/components/ui/rolling-number';
import { Text } from '@/components/ui/text';
import type { TodayChallenge } from '@/types/today';
import { ReminderAsk } from './reminder-ask';
import { WaterGlass } from './water-glass';

const BOWL_EMPTY = require('@/assets/images/world/bowl-empty.webp');
const BOWL_FULL = require('@/assets/images/world/bowl-full.webp');

/** Taps within this window go to the server as one log (fewer requests, no race on the cap). */
const BATCH_MS = 700;

interface Props {
  challenge: TodayChallenge;
  date: string;
  onError: (message: string) => void;
}

/**
 * Water as a glass you fill through the day: it holds today's share of the goal, each tap pours
 * one more glass in, and Mochi's bowl fills when the day is done (Plant Nanny-style care loop).
 */
export function WaterLog({ challenge, date, onError }: Props) {
  const log = useLogProgress(date);
  const { step, unit } = challenge.tracking;
  const goal = challenge.progress.goal;
  // Shown = what the server had when the sheet opened + every tap since (optimistic).
  const [poured, setPoured] = useState(0);
  const [pours, setPours] = useState(0);
  const pending = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const value = challenge.progress.value + poured;
  const full = value >= goal;

  const flush = () => {
    timer.current = null;
    const amount = pending.current;
    pending.current = 0;
    if (amount <= 0) return;
    log.mutate(
      { challengeId: challenge.id, amount },
      {
        onError: (err) => {
          setPoured((p) => p - amount);
          onError(err.message);
        },
      },
    );
  };

  // Closing the sheet mid-batch still saves what was poured.
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

  const pour = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (value + step >= goal && value < goal)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPoured((p) => p + step);
    setPours((n) => n + 1);
    pending.current += step;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, BATCH_MS);
  };

  return (
    <View className="items-center">
      <View className="w-full flex-row items-center justify-between">
        <View className="flex-row items-baseline">
          <RollingNumber value={value} format={fmt} className="font-serif text-4xl" />
          <Text className="ml-1 text-muted">
            / {fmt(goal)}
            {unit ? ` ${unit}` : ''}
          </Text>
        </View>
        <Animated.View key={full ? 'full' : 'empty'} entering={FadeIn.duration(350)}>
          <Image
            source={full ? BOWL_FULL : BOWL_EMPTY}
            style={{ width: 76, height: 86 }}
            contentFit="contain"
            accessibilityLabel={full ? 'Mochi drinking from a full bowl' : 'Mochi by an empty bowl'}
          />
        </Animated.View>
      </View>

      <Pressable
        onPress={pour}
        accessibilityRole="button"
        accessibilityLabel={`Drink a glass, ${fmt(step)}${unit ? ` ${unit}` : ''}`}
        accessibilityHint={`${fmt(value)} of ${fmt(goal)} so far`}
        className="mt-4 items-center active:opacity-90"
      >
        <WaterGlass level={goal ? value / goal : 0} pours={pours} />
      </Pressable>
      <Text className="mt-3 font-sans-semibold">{full ? 'Done for today' : 'Tap the glass'}</Text>
      <ReminderAsk />
    </View>
  );
}
