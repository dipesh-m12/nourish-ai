import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { sessionsApi } from '@/api/sessions';

const KEY = 'workout:active';

/** One exercise being timed. Wall-clock based, so closing the app loses nothing. */
export interface TimedWorkout {
  sessionId: string | null;
  exerciseId: string;
  title: string;
  /** The exercise's intensity: live kcal preview only (the server's number is saved). */
  met: number;
  date: string;
  startedAt: number;
  /** Total time spent paused so far. */
  pausedMs: number;
  /** Set while paused. */
  pausedAt: number | null;
}

function read(): Promise<TimedWorkout | null> {
  return AsyncStorage.getItem(KEY)
    .then((raw) => {
      const s = raw ? (JSON.parse(raw) as Partial<TimedWorkout>) : null;
      // Anything from an older shape (no exercise) is dropped rather than half-resumed.
      return s?.exerciseId ? (s as TimedWorkout) : null;
    })
    .catch(() => null);
}
const save = (s: TimedWorkout) =>
  AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => undefined);

/**
 * Time for a library exercise. Elapsed = now − start − paused, from stored timestamps, so the
 * phone sleeping or the app closing mid-set still counts. No GPS, no auto-pause: a plank or a
 * bench press doesn't move you, so only the user pauses it.
 */
export function useTimedWorkout() {
  const [state, setState] = useState<TimedWorkout | null>(null);
  const [restored, setRestored] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => {
    void read().then((s) => {
      setState(s);
      setNow(Date.now());
      setRestored(true);
    });
  }, []);

  const running = Boolean(state && !state.pausedAt);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  const update = useCallback((next: TimedWorkout | null) => {
    setState(next);
    setNow(Date.now());
    if (next) void save(next);
    else void AsyncStorage.removeItem(KEY).catch(() => undefined);
  }, []);

  const elapsedMs = state
    ? Math.max(0, (state.pausedAt ?? now) - state.startedAt - state.pausedMs)
    : 0;

  return {
    state,
    restored,
    elapsedMs,
    status: !state
      ? ('idle' as const)
      : state.pausedAt
        ? ('paused' as const)
        : ('running' as const),
    start: async (args: { exerciseId: string; title: string; met: number; date: string }) => {
      const s: TimedWorkout = {
        ...args,
        sessionId: null,
        startedAt: Date.now(),
        pausedMs: 0,
        pausedAt: null,
      };
      update(s);
      try {
        const session = await sessionsApi.start({
          kind: 'timer',
          date: args.date,
          data: { title: args.title, exerciseId: args.exerciseId },
        });
        update({ ...s, sessionId: session.id });
      } catch {
        // offline: it still times; finishing logs the exercise directly
      }
    },
    pause: () => state && !state.pausedAt && update({ ...state, pausedAt: Date.now() }),
    resume: () =>
      state?.pausedAt &&
      update({ ...state, pausedMs: state.pausedMs + Date.now() - state.pausedAt, pausedAt: null }),
    clear: () => update(null),
  };
}
