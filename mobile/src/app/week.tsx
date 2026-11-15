import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowDown, ArrowUp, Check, ChevronLeft, Minus } from 'lucide-react-native';
import { type ComponentRef, useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { levelToast, useSetLevel } from '@/api/challenges';
import { useWeek } from '@/api/week';
import { Button } from '@/components/ui/button';
import { ShareButton } from '@/components/ui/share-button';
import { SkeletonBlock, SkeletonGroup } from '@/components/ui/skeleton';
import { Heading, Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { useToast } from '@/store/toast';
import type { GoalChange, MarkerFlag, MarkerTrend, WeekReview, WeekStat } from '@/types/week';
import { localDate } from '@/utils/date';

const ART: Record<WeekReview['trend'], number> = {
  up: require('@/assets/images/world/flower-bloom.webp'),
  steady: require('@/assets/images/world/sprout.webp'),
  first: require('@/assets/images/world/sprout.webp'),
  down: require('@/assets/images/world/flower-wilted.webp'),
};

/**
 * "Is my health improving?" in one screen: a plant for the week, one line, three numbers
 * against last week (arrow + colour, never colour alone), the best habit, one fix, and their
 * reports area by area (the slow answer: did iron come back into range?).
 */
export default function WeekScreen() {
  const date = localDate();
  const week = useWeek(date);
  const setLevel = useSetLevel();
  // The share icon turns the whole check-in (plant to reports) into one picture.
  const shot = useRef<ComponentRef<typeof View>>(null);
  const toast = useToast((s) => s.show);
  const reduceMotion = useReducedMotion();
  // Goals follow progress: one tap moves it a step, from tomorrow (the server picks the number).
  const change = (g: GoalChange, direction: 'up' | 'down') =>
    setLevel.mutate(
      { id: g.challengeId, date, direction },
      { onSuccess: (r) => toast(levelToast(r)), onError: (err) => toast(err.message) },
    );
  const enter = (i: number) => (reduceMotion ? undefined : FadeInDown.delay(80 * i).duration(350));
  const w = week.data;

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between px-4 py-2">
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/dashboard'))}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="h-10 w-10 items-center justify-center rounded-full bg-card"
        >
          <ChevronLeft size={22} color={colors.ink} />
        </Pressable>
        {week.data && <ShareButton target={shot} title="Your week" />}
      </View>

      <ScrollView contentContainerClassName="pb-10" showsVerticalScrollIndicator={false}>
        <View ref={shot} collapsable={false} className="bg-bg px-6 pb-4">
          {week.isPending && <WeekSkeleton />}
          {week.isError && (
            <View className="items-center gap-3 pt-20">
              <Text className="text-center text-muted">{week.error.message}</Text>
              <Button variant="secondary" label="Try again" onPress={() => week.refetch()} />
            </View>
          )}

          {w && (
            <>
              <Animated.View entering={enter(0)} className="items-center pt-2">
                <Image
                  source={ART[w.trend]}
                  style={{ width: 96, height: 120 }}
                  contentFit="contain"
                />
                <Text className="mt-3 text-xs uppercase tracking-wider text-muted">Your week</Text>
                <Heading className="mt-1 text-center text-2xl">{w.headline}</Heading>
              </Animated.View>

              {w.stats.length > 0 && (
                <Animated.View
                  entering={enter(1)}
                  className="mt-8 overflow-hidden rounded-3xl bg-card"
                >
                  {w.stats.map((s, i) => (
                    <StatRow key={s.key} stat={s} first={i === 0} />
                  ))}
                </Animated.View>
              )}

              {w.best && (
                <Animated.View entering={enter(2)} className="mt-3 rounded-3xl bg-primary-soft p-4">
                  <View className="flex-row items-center gap-3">
                    <Image source={ART.up} style={{ width: 28, height: 36 }} contentFit="contain" />
                    <Text className="flex-1">
                      <Text className="text-muted">Best habit </Text>
                      <Text className="font-sans-semibold">{w.best}</Text>
                    </Text>
                  </View>
                  {/* Every day this week: the next step, ready to take. */}
                  {w.levelUp && (
                    <Button
                      className="mt-3"
                      label={`Level up: ${goalText(w.levelUp)}`}
                      loading={setLevel.isPending && setLevel.variables?.direction === 'up'}
                      onPress={() => change(w.levelUp!, 'up')}
                    />
                  )}
                </Animated.View>
              )}

              {w.focus && (
                <Animated.View entering={enter(3)} className="mt-3 rounded-3xl bg-card p-4">
                  <Text>
                    <Text className="text-muted">Work on </Text>
                    <Text className="font-sans-semibold">{w.focus.label}</Text>
                  </Text>
                  {/* One step down in one tap when the habit can move; otherwise Nourish helps. */}
                  {w.focus.ease ? (
                    <Button
                      className="mt-3"
                      label={`Make it ${goalText(w.focus.ease)}`}
                      loading={setLevel.isPending && setLevel.variables?.direction === 'down'}
                      onPress={() => change(w.focus!.ease!, 'down')}
                    />
                  ) : (
                    <Button
                      className="mt-3"
                      label="Make it easier"
                      onPress={() =>
                        router.push({ pathname: '/assistant', params: { prompt: w.focus!.prompt } })
                      }
                    />
                  )}
                </Animated.View>
              )}

              {w.reports.length > 0 && (
                <Animated.View entering={enter(4)} className="mt-8">
                  <Text className="mb-3 font-sans-semibold text-sm uppercase tracking-wider text-muted">
                    From your reports
                  </Text>
                  <View className="overflow-hidden rounded-3xl bg-card">
                    {w.reports.map((m, i) => (
                      <MarkerRow key={m.area} marker={m} first={i === 0} />
                    ))}
                  </View>
                </Animated.View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatRow({ stat: s, first }: { stat: WeekStat; first: boolean }) {
  const Icon = s.better === null ? null : s.better ? ArrowUp : ArrowDown;
  const tint = s.better ? colors.primary : colors.accent;
  return (
    <View
      className={`flex-row items-center px-4 py-3.5 ${first ? '' : 'border-t border-line'}`}
      accessible
      accessibilityLabel={`${s.label}: ${s.now}${s.before ? `, last week ${s.before}` : ''}${
        s.better === null ? '' : s.better ? ', better' : ', lower'
      }`}
    >
      <Text className="flex-1 text-muted">{s.label}</Text>
      {s.before && <Text className="mr-3 text-sm text-muted">{s.before} →</Text>}
      <Text className="font-sans-semibold text-base">{s.now}</Text>
      <View className="ml-2 w-5 items-end">
        {Icon ? (
          <Icon size={16} color={tint} strokeWidth={2.5} />
        ) : (
          <Minus size={14} color={colors.line} />
        )}
      </View>
    </View>
  );
}

/** "25 min" */
const goalText = (g: GoalChange) => `${g.to}${g.unit ? ` ${g.unit}` : ''}`;

const FLAG: Record<MarkerFlag, string> = { low: 'Low', high: 'High', normal: 'Normal' };

/** One area: what it's for, then where it stands (and where it was, when that changed). */
function MarkerRow({ marker: m, first }: { marker: MarkerTrend; first: boolean }) {
  const ok = m.now === 'normal';
  const changed = m.before !== null && m.before !== m.now;
  return (
    <View
      className={`flex-row items-center px-4 py-3.5 ${first ? '' : 'border-t border-line'}`}
      accessible
      accessibilityLabel={`${m.label}, for ${m.feel}: ${FLAG[m.now]}${
        changed ? `, was ${FLAG[m.before!]}` : ''
      }`}
    >
      <View className="flex-1">
        <Text className="font-sans-semibold">{m.label}</Text>
        <Text className="text-xs text-muted">for {m.feel}</Text>
      </View>
      {changed && <Text className="mr-2 text-sm text-muted">{FLAG[m.before!]} →</Text>}
      <View
        className={`h-7 flex-row items-center gap-1 rounded-full px-2.5 ${
          ok ? 'bg-primary-soft' : 'bg-accent-soft'
        }`}
      >
        {m.trend === 'better' && <Check size={13} color={colors.primary} strokeWidth={3} />}
        <Text
          className="font-sans-semibold text-xs"
          style={{ color: ok ? colors.primary : colors.accentText }}
        >
          {FLAG[m.now]}
        </Text>
      </View>
    </View>
  );
}

function WeekSkeleton() {
  return (
    <SkeletonGroup
      accessible
      accessibilityLabel="Loading your week"
      accessibilityState={{ busy: true }}
    >
      <View className="items-center pt-2">
        <SkeletonBlock className="h-28 w-24 rounded-2xl" />
        <SkeletonBlock className="mt-4 h-6 w-3/4" />
      </View>
      <SkeletonBlock className="mt-8 h-40 w-full rounded-3xl" />
    </SkeletonGroup>
  );
}
