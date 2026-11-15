import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sessionsApi } from '@/api/sessions';
import { useToday } from '@/api/today';
import { WalkMap } from '@/components/formats/walk-map';
import { WalkSummary, type WalkResult } from '@/components/formats/walk-summary';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { downsample, useWalkTracker } from '@/hooks/use-walk-tracker';
import { isNetworkError, queueWalk, sendWalk, type PendingWalk } from '@/lib/walk-outbox';
import { useToast } from '@/store/toast';
import { localDate } from '@/utils/date';
import { formatClock, formatDistance } from '@/utils/geo';

/**
 * What gets logged, in the challenge's own unit: steps (the phone's counter, else ~0.75 m a
 * step), km to one decimal, or whole minutes moved.
 */
function amountFor(unit: string | null, elapsedMs: number, metres: number, steps: number | null) {
  if (/^steps$/i.test(unit ?? '')) return steps ?? Math.round(metres / 0.75);
  if (/^km$/i.test(unit ?? '')) return Math.round(metres / 100) / 10;
  return Math.floor(elapsedMs / 60_000);
}

/**
 * A walk, live: the map follows the phone's blue dot and draws the path, while time, distance
 * and steps count up. It survives the app closing (see useWalkTracker); finishing logs it to
 * the challenge and keeps a trophy card that can be shared and reopened.
 */
export default function WalkScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const date = localDate();
  const today = useToday(date);
  const walk = useWalkTracker();
  const toast = useToast((s) => s.show);
  const [leaving, setLeaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<WalkResult | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // A walk left running wins over the link that opened this screen.
  const challengeId = walk.walk?.challengeId ?? params.id ?? null;
  const challenge = today.data?.challenges.find((c) => c.id === challengeId);
  const title = walk.walk?.title ?? challenge?.tracking.label ?? challenge?.title ?? 'Walk';
  const active = walk.status !== 'idle' && !summary;

  // Android back mid-walk asks first, so a stray swipe doesn't throw the walk away.
  useEffect(() => {
    if (!active) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setLeaving(true);
      return true;
    });
    return () => sub.remove();
  }, [active]);

  const finish = async () => {
    const w = walk.walk;
    if (!w) return;
    // Snapshot first: pausing to save must not count as one more pause on the card.
    const done = {
      title,
      path: downsample(w.path),
      metres: Math.round(walk.metres),
      movingMs: Math.round(walk.elapsedMs),
      steps: walk.steps,
      pauses: w.pauses,
      awayMs: Math.round(w.awayMs),
    };
    const amount = amountFor(
      challenge?.tracking.unit ?? null,
      walk.elapsedMs,
      walk.metres,
      walk.steps,
    );
    if (challenge && amount <= 0) {
      setNote('Too short to count. Keep going a little.');
      return;
    }
    walk.pause();
    setSaving(true);
    const pending: PendingWalk = {
      sessionId: w.sessionId,
      challengeId: w.challengeId,
      date: w.date,
      amount: challenge ? amount : undefined,
      data: done,
    };
    try {
      let calories: number | null = null;
      try {
        // Started offline: sendWalk opens the server session first, so it still gets a trophy.
        calories = (await sendWalk(pending)).calories;
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        // No signal: keep it on the phone; it's sent when the app is next online.
        await queueWalk(pending);
        toast('Saved on your phone. It syncs when you’re online.');
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await walk.clear();
      setSummary({ ...done, calories });
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Couldn’t save the walk.');
      walk.resume();
    } finally {
      setSaving(false);
    }
  };

  const discard = async () => {
    const id = walk.walk?.sessionId;
    await walk.clear();
    if (id) void sessionsApi.cancel(id).catch(() => undefined);
    router.back();
  };

  if (summary) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg px-6">
        <WalkSummary result={summary} onDone={() => router.back()} />
      </SafeAreaView>
    );
  }

  if (walk.restored === 'checking') {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      {walk.status === 'running' && <KeepAwake />}
      <WalkMap path={walk.path} locate={walk.allowed === true} />

      <SafeAreaView edges={['top']} className="absolute left-4 top-0">
        <Pressable
          onPress={() => (active ? setLeaving(true) : router.back())}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="mt-2 h-10 w-10 items-center justify-center rounded-full bg-card"
        >
          <ChevronLeft size={22} color={colors.ink} />
        </Pressable>
      </SafeAreaView>

      {/* The panel sits in the column flow under the map (no floating controls over content). */}
      <SafeAreaView edges={['bottom']} className="rounded-t-3xl bg-card px-6 pb-4 pt-5">
        <Text className="text-sm text-muted" numberOfLines={1}>
          {challenge ? `${title} · ${challenge.target}` : title}
        </Text>
        <View className="mt-2 flex-row items-end justify-between">
          <View>
            <Text
              className="font-serif-bold text-5xl"
              accessibilityLabel={`Time ${formatClock(walk.elapsedMs)}`}
            >
              {formatClock(walk.elapsedMs)}
            </Text>
            {walk.status === 'running' && !walk.moving && (
              <Animated.View entering={FadeIn.duration(200)}>
                <Text className="text-sm text-muted">Paused while you stand still</Text>
              </Animated.View>
            )}
          </View>
          <Animated.View entering={FadeInDown.duration(300)} className="items-end">
            <Text className="font-sans-semibold text-xl">{formatDistance(walk.metres)}</Text>
            {walk.steps !== null && <Text className="text-sm text-muted">{walk.steps} steps</Text>}
          </Animated.View>
        </View>

        {walk.status !== 'idle' && !walk.background && (
          <Text className="mt-2 text-xs text-muted">Keep the app open for the route.</Text>
        )}
        {(note ?? walk.problem) && (
          <Text className="mt-2 text-sm text-danger">{note ?? walk.problem}</Text>
        )}

        <View className="mt-4 flex-row gap-3">
          {walk.status === 'idle' && (
            <Button
              className="flex-1"
              label="Start"
              disabled={!walk.allowed}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                void walk.start({ challengeId, title, date });
              }}
            />
          )}
          {walk.status === 'running' && (
            <>
              <Button className="flex-1" variant="secondary" label="Pause" onPress={walk.pause} />
              <Button
                className="flex-1"
                label="Finish"
                loading={saving}
                onPress={() => void finish()}
              />
            </>
          )}
          {walk.status === 'paused' && (
            <>
              <Button
                className="flex-1"
                variant="secondary"
                label="Resume"
                onPress={() => {
                  setNote(null);
                  walk.resume();
                }}
              />
              <Button
                className="flex-1"
                label="Finish"
                loading={saving}
                onPress={() => void finish()}
              />
            </>
          )}
        </View>
      </SafeAreaView>

      <ConfirmDialog
        visible={leaving}
        title="Leave the walk?"
        message="It keeps going. Come back to finish it, or end it now without saving."
        confirmLabel="End walk"
        cancelLabel="Keep going"
        destructive
        onConfirm={() => void discard()}
        onCancel={() => {
          setLeaving(false);
          router.back();
        }}
        onDismiss={() => setLeaving(false)}
      />
    </View>
  );
}

/** Mounted only while walking: keeps the screen on so in-app tracking doesn't stop. */
function KeepAwake() {
  useKeepAwake();
  return null;
}
