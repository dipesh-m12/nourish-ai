import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { sessionsApi } from '@/api/sessions';
import { CatFace } from '@/components/companion/cat-face';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { cancelDoneAlert, scheduleDoneAlert } from '@/lib/session-alert';
import type { TodayChallenge } from '@/types/today';

/** One breath: 4 s in, 6 s out (a slow exhale is what calms; Headspace-style pacing). */
const IN_MS = 4000;
const OUT_MS = 6000;
const BREATH_MS = IN_MS + OUT_MS;
const EASE = Easing.inOut(Easing.sin);

interface Props {
  challenge: TodayChallenge;
  date: string;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}

/** Durations offered: what's left today first, then short sessions. */
function choices(left: number) {
  const set = new Set([1, 3, 5, Math.max(1, Math.ceil(left))]);
  return [...set].filter((m) => m <= 60).sort((a, b) => a - b);
}

/**
 * Timed habits (breathing, meditation, plank, stretching) as a guided session: an orb breathes
 * with you, a soft haptic marks each turn, and the screen stays awake. The start time is saved
 * on the server, so closing the app or the screen sleeping doesn't lose it: reopening picks the
 * session up (or logs it, if the time ran out meanwhile), and a notification says when it's done.
 */
export function TimerLog({ challenge, date, onDone, onError }: Props) {
  const left = Math.max(0, challenge.progress.goal - challenge.progress.value);
  const options = choices(left || challenge.tracking.step);
  const [minutes, setMinutes] = useState(
    options.includes(Math.ceil(left)) ? Math.ceil(left) : options[0]!,
  );
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [finished, setFinished] = useState(false);
  const [resuming, setResuming] = useState(Boolean(challenge.session));

  const running = startedAt !== null && !finished;
  const total = minutes * 60_000;
  const elapsed = running ? Math.min(total, now - startedAt) : 0;

  const save = (id: string | null, mins: number) => {
    void cancelDoneAlert();
    const done = () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDone(`+${mins} min. Nicely done.`);
    };
    if (!id) return onError('Couldn’t save the session. Check your connection.');
    sessionsApi
      .finish(id, { date, amount: mins })
      .then(done)
      .catch((e: Error) => onError(e.message));
  };

  // A session left running (app closed): pick it up, or log it if the time ran out.
  useEffect(() => {
    const running = challenge.session;
    if (!running || running.kind !== 'timer') return;
    let live = true;
    sessionsApi
      .get(running.id)
      .then((s) => {
        if (!live) return;
        const mins = s.data.minutes ?? 1;
        const began = new Date(s.startedAt).getTime();
        setMinutes(mins);
        setSessionId(s.id);
        setNow(Date.now());
        setStartedAt(began);
      })
      .catch(() => undefined)
      .finally(() => live && setResuming(false));
    return () => {
      live = false;
    };
  }, [challenge.session]);

  // Tick once a second while running; the tick that reaches the end finishes and logs.
  useEffect(() => {
    if (startedAt === null || finished) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t - startedAt >= total) {
        setFinished(true);
        save(sessionId, minutes);
        return true;
      }
      return false;
    };
    if (tick()) return;
    const id = setInterval(() => tick() && clearInterval(id), 1000);
    return () => clearInterval(id);
    // save only reads stable values for this run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt, finished, total, minutes, sessionId]);

  const start = () => {
    const t = Date.now();
    setNow(t);
    setStartedAt(t);
    void scheduleDoneAlert(challenge, minutes);
    sessionsApi
      .start({ kind: 'timer', challengeId: challenge.id, date, data: { minutes } })
      .then((s) => setSessionId(s.id))
      .catch(() => onError('Couldn’t start the session. Check your connection.'));
  };
  const stop = () => {
    const mins = Math.floor(elapsed / 60_000);
    setFinished(true);
    if (mins >= 1) return save(sessionId, mins);
    void cancelDoneAlert();
    if (sessionId) void sessionsApi.cancel(sessionId).catch(() => undefined);
    onDone('Stopped. Even a minute counts next time.');
  };

  if (resuming) {
    return (
      <View className="items-center py-10">
        <Orb running={false} />
      </View>
    );
  }

  if (finished) {
    return (
      <Animated.View entering={FadeIn.duration(400)} className="items-center py-6">
        <CatFace mood="happy" size={140} />
        <Text className="mt-3 font-serif text-2xl">Calm, and counted.</Text>
      </Animated.View>
    );
  }

  return (
    <View className="items-center">
      {running ? <Session elapsed={elapsed} total={total} /> : <Orb running={false} />}

      {!running && (
        <View className="mt-6 w-full">
          <View className="flex-row flex-wrap justify-center gap-2">
            {options.map((m) => (
              <Chip
                key={m}
                role="radio"
                label={`${m} min`}
                selected={minutes === m}
                onPress={() => setMinutes(m)}
              />
            ))}
          </View>
          <Button className="mt-5" label="Start" onPress={start} />
        </View>
      )}
      {running && (
        <Button className="mt-6 self-stretch" variant="secondary" label="Stop" onPress={stop} />
      )}
    </View>
  );
}

/** The running session: breathing orb + time left. Mounting it keeps the screen awake. */
function Session({ elapsed, total }: { elapsed: number; total: number }) {
  useKeepAwake();
  const secsLeft = Math.ceil((total - elapsed) / 1000);
  const phaseIn = elapsed % BREATH_MS < IN_MS;
  useEffect(() => {
    Haptics.impactAsync(
      phaseIn ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Soft,
    );
  }, [phaseIn]);
  return (
    <View className="items-center">
      <Orb running />
      <Text className="mt-4 font-sans-semibold text-lg" accessibilityLiveRegion="polite">
        {phaseIn ? 'Breathe in' : 'Breathe out'}
      </Text>
      <Text className="text-muted">
        {Math.floor(secsLeft / 60)}:{String(secsLeft % 60).padStart(2, '0')}
      </Text>
    </View>
  );
}

function Orb({ running }: { running: boolean }) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(0.6);

  useEffect(() => {
    if (!running || reduceMotion) {
      cancelAnimation(scale);
      scale.set(withTiming(0.7, { duration: 300 }));
      return;
    }
    scale.set(0.6);
    scale.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: IN_MS, easing: EASE }),
          withTiming(0.6, { duration: OUT_MS, easing: EASE }),
        ),
        -1,
      ),
    );
  }, [running, reduceMotion, scale]);

  const outer = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const inner = useAnimatedStyle(() => ({
    transform: [{ scale: 0.55 + (scale.get() - 0.6) * 0.6 }],
  }));

  return (
    <View className="items-center justify-center" style={{ width: 220, height: 220 }}>
      <Animated.View
        className="absolute rounded-full bg-primary-soft"
        style={[{ width: 220, height: 220 }, outer]}
      />
      <Animated.View
        className="absolute rounded-full"
        style={[{ width: 220, height: 220, backgroundColor: '#A9CDB7' }, inner]}
      />
    </View>
  );
}
