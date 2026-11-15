import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { TapHint } from '@/components/ui/tap-hint';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import type { TodayChallenge } from '@/types/today';
import { weekdayLetter } from '@/utils/date';

interface DaySummary {
  date: string;
  /** Daily challenges active that day. */
  active: number;
  done: number;
}

/** Folds every daily challenge's 28-day history into one row per day. */
function summarise(challenges: TodayChallenge[]): DaySummary[] {
  const daily = challenges.filter((c) => c.frequency === 'daily');
  const days = daily[0]?.progress.history.map((h) => h.date) ?? [];
  return days.map((date, i) => {
    let active = 0;
    let done = 0;
    for (const c of daily) {
      const h = c.progress.history[i];
      if (!h?.active) continue;
      active++;
      if (h.value >= h.goal) done++;
    }
    return { date, active, done };
  });
}

const FLOWER = require('@/assets/images/world/flower-bloom.webp');
const SPROUT = require('@/assets/images/world/sprout.webp');
const WILTED = require('@/assets/images/world/flower-wilted.webp');

/** What grew that day: all done = a flower, some = a sprout, none = wilted, not started = soil. */
function plantFor(d: DaySummary, isToday: boolean) {
  if (!d.active) return null;
  if (d.done === d.active) return FLOWER;
  if (d.done > 0) return SPROUT;
  return isToday ? null : WILTED; // today isn't over: no wilting yet
}

/**
 * The week as Mochi's garden instead of stats: seven plants, one line. Feeling first (the
 * reviewer's point: "any stats I have to put my mind on is not a PA").
 */
export function ConsistencyCard({
  challenges,
  hint,
  onOpen,
}: {
  challenges: TodayChallenge[];
  /** Show the tap hint (until the card has been opened once). */
  hint?: boolean;
  /** Called on open, before navigating (marks the hint as used). */
  onOpen?: () => void;
}) {
  const days = summarise(challenges);
  const reduceMotion = useReducedMotion();
  if (!days.length) return null;
  const week = days.slice(-7);
  // Nothing has grown yet (first day, nothing done): an empty row of soil says nothing.
  if (!week.some((d) => d.active > 0 && d.done > 0)) return null;
  // One number on top, the garden under it: how many days this week every habit got done.
  const full = week.filter((d) => d.active > 0 && d.done === d.active).length;

  return (
    <Animated.View entering={FadeIn.duration(300)}>
      <Pressable
        onPress={() => {
          onOpen?.();
          router.push('/week');
        }}
        className="rounded-3xl bg-card px-4 pb-3 pt-4 active:opacity-90"
        accessibilityRole="button"
        accessibilityLabel={`${full} of ${week.length} full days this week. Open the weekly check-in`}
      >
        <View className="mb-3 flex-row items-baseline gap-2">
          <Text className="font-num-black text-3xl" style={{ color: colors.primary }}>
            {full}
          </Text>
          <Text className="font-sans-semibold text-xs text-muted">of {week.length} full days</Text>
        </View>
        <View className="flex-row items-end justify-between">
          {week.map((d, i) => {
            const isToday = i === week.length - 1;
            const plant = plantFor(d, isToday);
            return (
              <View key={d.date} className="flex-1 items-center">
                <View className="h-12 w-full items-center justify-end">
                  {plant ? (
                    <Animated.View
                      entering={reduceMotion ? undefined : ZoomIn.delay(i * 60).springify()}
                    >
                      <Image
                        source={plant}
                        style={{ width: 30, height: 40 }}
                        contentFit="contain"
                      />
                    </Animated.View>
                  ) : (
                    <View className="mb-1 h-1.5 w-6 rounded-full bg-line" />
                  )}
                </View>
                <Text
                  className={
                    isToday ? 'mt-1 font-sans-semibold text-[10px]' : 'mt-1 text-[10px] text-muted'
                  }
                >
                  {weekdayLetter(d.date)}
                </Text>
              </View>
            );
          })}
        </View>
        {hint && (
          <View style={{ position: 'absolute', right: 6, bottom: 6 }}>
            <TapHint />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}
