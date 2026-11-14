import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, Pause, Play, Timer, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useLogActivity } from '@/api/activities';
import { exerciseKeys, useExercise } from '@/api/exercises';
import { useMe } from '@/api/profiles';
import { sessionsApi } from '@/api/sessions';
import { ExerciseDemo } from '@/components/exercises/exercise-demo';
import { WalkSummary, type WalkResult } from '@/components/formats/walk-summary';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { previewKcal } from '@/constants/activities';
import { colors } from '@/constants/colors';
import { useTimedWorkout } from '@/hooks/use-timed-workout';
import { localDate } from '@/utils/date';
import { formatClock } from '@/utils/geo';

const NUM = 'BarlowCondensed_800ExtraBold';
const NUM_MID = 'BarlowCondensed_700Bold';
const COUNT_FROM = 3;

/**
 * Doing a library exercise, timed (opened from its page: Start). After Apple Fitness's workout:
 * 3-2-1, then one big live number at the top and one control panel at the bottom. Only the user
 * pauses it (no GPS or "standing still" here: a plank doesn't move you). Paused shows Resume and
 * Done side by side. Live kcal is a preview (MET × kg × time); the server saves the real one.
 */
export default function WorkoutScreen() {
  const params = useLocalSearchParams<{ exercise?: string; name?: string; met?: string }>();
  const date = localDate();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const kg = useMe().data?.weightKg ?? 70;
  const timed = useTimedWorkout();
  const logActivity = useLogActivity(date);
  const [counting, setCounting] = useState<number | null>(null);
  const [summary, setSummary] = useState<WalkResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [decided, setDecided] = useState(false);

  // A session left running (app closed) resumes as is; otherwise this screen's exercise.
  const exerciseId = timed.state?.exerciseId ?? params.exercise ?? '';
  const title = timed.state?.title ?? params.name ?? 'Exercise';
  const met = timed.state?.met ?? (Number(params.met) || 3.5);
  // The exercise's own photos (the same moving demo as its page); cached from that page.
  const images = useExercise(date, exerciseId).data?.images ?? [];
  const minutes = timed.elapsedMs / 60_000;
  const kcal = previewKcal(met, minutes, kg);
  const live = timed.status !== 'idle' && !summary;

  // Once storage is read: resume, or count in. (Derived during render, not in an effect.)
  if (timed.restored && !decided) {
    setDecided(true);
    if (!timed.state) setCounting(COUNT_FROM);
  }

  // 3, 2, 1… then go.
  useEffect(() => {
    if (counting === null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const id = setTimeout(() => {
      if (counting > 1) return setCounting(counting - 1);
      setCounting(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void timed.start({ exerciseId, title, met, date });
    }, 1000);
    return () => clearTimeout(id);
    // start is stable for this screen's life; the rest are fixed once counting begins
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counting]);

  // Back mid-session asks first.
  useEffect(() => {
    if (!live) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setLeaving(true);
      return true;
    });
    return () => sub.remove();
  }, [live]);

  const pause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    timed.pause();
  };
  const resume = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setProblem(null);
    timed.resume();
  };

  const finish = async () => {
    if (minutes < 1) return setProblem('Keep going a little: a minute counts.');
    setSaving(true);
    const movingMs = Math.round(timed.elapsedMs);
    try {
      let calories: number | null = null;
      const sessionId = timed.state?.sessionId;
      if (sessionId) {
        const r = await sessionsApi.finish(sessionId, {
          date,
          data: { exerciseId, title, movingMs, metres: 0, pauses: 0 },
        });
        calories = r.calories;
      } else {
        // Started offline: log it as a plain exercise.
        const r = await logActivity.mutateAsync({
          exerciseId,
          minutes: Math.max(1, Math.round(minutes)),
        });
        calories = r.verified ? r.activity.calories : null;
      }
      void queryClient.invalidateQueries({ queryKey: exerciseKeys.all }); // "Done today"
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      timed.clear();
      setSummary({ title, path: [], metres: 0, movingMs, steps: null, pauses: 0, calories });
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Couldn’t save it.');
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    const id = timed.state?.sessionId;
    timed.clear();
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

  if (!timed.restored || !decided) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (counting !== null) return <Countdown value={counting} title={title} />;

  const paused = timed.status === 'paused';

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      {timed.status === 'running' && <KeepAwake />}

      <View className="flex-row items-center gap-3 px-4 py-2">
        <Pressable
          onPress={() => setLeaving(true)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
          className="h-10 w-10 items-center justify-center rounded-full bg-card"
        >
          <X size={20} color={colors.ink} />
        </Pressable>
        <Text className="flex-1 font-sans-semibold text-base" numberOfLines={1}>
          {title}
        </Text>
      </View>

      {/* The kcal sits in the top corner (well clear of the edges); the movement fills the middle. */}
      <View className="flex-1 px-6 pb-6">
        <Animated.View
          entering={FadeIn.duration(300)}
          className="mt-2 self-start"
          accessible
          accessibilityLabel={`${kcal} active kilocalories`}
        >
          <Text style={styles.big}>{kcal}</Text>
          <Text style={styles.label}>ACTIVE KCAL</Text>
        </Animated.View>

        <View className="flex-1 items-center justify-center">
          {images.length > 0 && (
            <Animated.View entering={FadeIn.delay(100).duration(350)} className="w-full">
              <ExerciseDemo
                images={images}
                className="w-full rounded-3xl"
                style={{ aspectRatio: 4 / 3 }}
              />
            </Animated.View>
          )}
          {problem && <Text className="mt-4 text-center text-sm text-danger">{problem}</Text>}
        </View>
      </View>

      {/* The panel: time, then the controls. Paused = Resume + Done side by side. */}
      <Animated.View
        entering={FadeInDown.duration(350)}
        className="items-center rounded-t-[32px] bg-card px-6 pt-6"
        style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}
      >
        <Text style={styles.clock} accessibilityLabel={`Time ${formatClock(timed.elapsedMs)}`}>
          {formatClock(timed.elapsedMs)}
        </Text>

        <View className="mt-6 flex-row items-start justify-center gap-10">
          {paused ? (
            <>
              <Control
                label="Resume"
                onPress={resume}
                color={colors.primary}
                icon={<Play size={30} color="#fff" fill="#fff" style={{ marginLeft: 3 }} />}
              />
              <Control
                label="Done"
                onPress={() => void finish()}
                color={colors.ink}
                busy={saving}
                icon={<Check size={32} color="#fff" strokeWidth={3} />}
              />
            </>
          ) : (
            <Control
              label="Pause"
              onPress={pause}
              color={colors.ink}
              icon={<Pause size={30} color="#fff" fill="#fff" />}
            />
          )}
        </View>
      </Animated.View>

      <ConfirmDialog
        visible={leaving}
        title="Leave this exercise?"
        message="It keeps timing. Come back to finish it, or end it now without saving."
        confirmLabel="End without saving"
        cancelLabel="Keep going"
        destructive
        onConfirm={discard}
        onCancel={() => {
          setLeaving(false);
          router.back();
        }}
        onDismiss={() => setLeaving(false)}
      />
    </SafeAreaView>
  );
}

/** A big round button with a one-word label under it. */
function Control({
  label,
  onPress,
  color,
  icon,
  busy,
}: {
  label: string;
  onPress: () => void;
  color: string;
  icon: React.ReactNode;
  busy?: boolean;
}) {
  return (
    <View className="items-center gap-2">
      <PressableScale
        onPress={onPress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={label}
        className="h-20 w-20 items-center justify-center rounded-full"
        style={{ backgroundColor: color }}
      >
        {busy ? <ActivityIndicator color="#fff" /> : icon}
      </PressableScale>
      <Text className="font-sans-semibold text-sm text-muted">{label}</Text>
    </View>
  );
}

const RING = 240;
const STROKE = 16;
const R = (RING - STROKE) / 2;
const C = 2 * Math.PI * R;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** 3-2-1: the ring sweeps once per number, a timer icon above, the exercise below. */
function Countdown({ value, title }: { value: number; title: string }) {
  const reduceMotion = useReducedMotion();
  const sweep = useSharedValue(0);
  useEffect(() => {
    sweep.set(0);
    sweep.set(
      reduceMotion ? 1 : withTiming(1, { duration: 950, easing: Easing.out(Easing.cubic) }),
    );
  }, [value, sweep, reduceMotion]);
  const arc = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - sweep.get()) }));

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-bg px-8">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-primary-soft">
        <Timer size={26} color={colors.primary} />
      </View>
      <View className="mt-6 items-center justify-center" style={{ width: RING, height: RING }}>
        <Svg
          width={RING}
          height={RING}
          style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}
        >
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={R}
            stroke={colors.primarySoft}
            strokeWidth={STROKE}
            fill="none"
          />
          <AnimatedCircle
            cx={RING / 2}
            cy={RING / 2}
            r={R}
            stroke={colors.primary}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={C}
            animatedProps={arc}
          />
        </Svg>
        <Animated.Text key={value} entering={FadeIn.duration(200)} style={styles.count}>
          {value}
        </Animated.Text>
      </View>
      <Text className="mt-6 text-center font-sans-semibold text-xl" numberOfLines={2}>
        {title}
      </Text>
    </SafeAreaView>
  );
}

/** Mounted only while running: keeps the screen on. */
function KeepAwake() {
  useKeepAwake();
  return null;
}

const styles = StyleSheet.create({
  big: { fontFamily: NUM, fontSize: 64, lineHeight: 68, color: colors.ink },
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    letterSpacing: 0.8,
    color: colors.muted,
  },
  clock: { fontFamily: NUM_MID, fontSize: 56, lineHeight: 60, color: colors.primary },
  count: { fontFamily: NUM, fontSize: 120, color: colors.ink },
  panel: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
});
