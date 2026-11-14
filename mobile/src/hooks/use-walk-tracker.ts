import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { sessionsApi } from '@/api/sessions';
import { stepsBetween } from '@/lib/health';
import { drainFixes, startBackgroundWalk, stopBackgroundWalk, type RawFix } from '@/lib/walk-task';
import { metresBetween, type LngLat } from '@/utils/geo';

/** GPS fixes worse than this are ignored (indoors they wander by tens of metres). */
const MAX_ACCURACY_M = 25;
/**
 * Sitting still, GPS wanders inside its accuracy circle. A fix only counts once it leaves
 * that circle (and at least MIN_STEP_M) from the last counted point, so jitter never adds up.
 */
const MIN_STEP_M = 10;
const MAX_STEP_M = 120;
/** Faster than a brisk run between fixes = a glitch, not a walk. */
const MAX_SPEED_MS = 6; // default (walking); a bike passes its own via options
/** No step and no real move for this long = standing still: the clock stops (auto-pause). */
const STILL_AFTER_MS = 8000;
/** A clock tick later than this means the app was asleep or closed: fill the gap. */
const GAP_MS = 15_000;
/** Never credit more than this for time away with no data at all. */
const MAX_BLIND_MS = 3 * 3_600_000;
/** Two background fixes closer than this in time count as walking in between. */
const MOVING_GAP_MS = 30_000;
/** Roughly 100 steps a minute at a walking pace. */
const MS_PER_STEP = 600;
const STORE_KEY = 'walk:active';
const CHECKPOINT_MS = 60_000;

export type WalkStatus = 'idle' | 'running' | 'paused';

/** Everything needed to pick a walk back up after the app was closed. */
export interface WalkState {
  sessionId: string | null;
  challengeId: string | null;
  title: string;
  date: string;
  status: 'running' | 'paused';
  startedAt: number;
  movingMs: number;
  metres: number;
  /** Steps from the phone's counter plus any filled in from Health Connect. */
  steps: number;
  pauses: number;
  /** Time credited while the app wasn't running. */
  awayMs: number;
  path: LngLat[];
  /** Last moment the app's clock ran. */
  lastTickAt: number;
  /** Last counted GPS point. */
  anchor: LngLat | null;
  /** Fixes come from the background service (true) or only while the screen is open. */
  background: boolean;
}

export async function readStoredWalk(): Promise<WalkState | null> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as WalkState) : null;
  } catch {
    return null;
  }
}
const saveWalk = (s: WalkState) =>
  AsyncStorage.setItem(STORE_KEY, JSON.stringify(s)).catch(() => undefined);
const clearWalk = () => AsyncStorage.removeItem(STORE_KEY).catch(() => undefined);

/** At most `max` points, evenly picked, always keeping the first and last. */
export function downsample(path: LngLat[], max = 1000): LngLat[] {
  if (path.length <= max) return path;
  const step = (path.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => path[Math.round(i * step)]!);
}

/**
 * Tracks a walk: route, distance, moving time, steps, stops. The walk is stored on the phone
 * (every few seconds) and on the server (every minute), so closing the app or the screen
 * sleeping never loses it. With the background service, GPS keeps collecting meanwhile; without
 * it, the gap is filled from Health Connect steps, or counted as time if there's nothing to go on
 * (and the card says so).
 *
 * Sitting still adds nothing: with a step counter, GPS only counts while steps are coming in;
 * without one, a fix must leave its own accuracy circle.
 */
export function useWalkTracker({ maxSpeed = MAX_SPEED_MS }: { maxSpeed?: number } = {}) {
  const [walk, setWalk] = useState<WalkState | null>(null);
  const [moving, setMoving] = useState(false);
  const [restored, setRestored] = useState<'none' | 'checking' | 'resumed'>('checking');
  const [problem, setProblem] = useState<string | null>(null);
  /** null = not asked yet. The map only shows the blue dot once this is true. */
  const [allowed, setAllowed] = useState<boolean | null>(null);

  // The live copy, mutated by GPS/step/clock callbacks; React state mirrors it once a second.
  const ref = useRef<WalkState | null>(null);
  const lastMoveAt = useRef(0);
  const wasMoving = useRef(false);
  const hasPedometer = useRef(false);
  const lastFixT = useRef(0);
  const lastCheckpoint = useRef(0);

  const publish = useCallback(() => {
    const s = ref.current;
    setWalk(s ? { ...s } : null);
    if (s) void saveWalk(s);
  }, []);

  // Ask for location once on open, and pick up a walk left running.
  useEffect(() => {
    void Location.requestForegroundPermissionsAsync()
      .then((p) => {
        setAllowed(p.granted);
        if (!p.granted) setProblem('Location is off. Allow it to see your path.');
      })
      .catch(() => setAllowed(false));
    void readStoredWalk().then((s) => {
      if (s) {
        ref.current = s;
        lastMoveAt.current = Date.now();
        publish();
      }
      setRestored(s ? 'resumed' : 'none');
    });
  }, [publish]);

  /** Scores one GPS fix. `live` = it arrived just now with the screen open. */
  const takeFix = useCallback(
    (fix: RawFix, live: boolean) => {
      const s = ref.current;
      if (!s || s.status !== 'running') return;
      const accuracy = fix.acc ?? MAX_ACCURACY_M;
      if (accuracy > MAX_ACCURACY_M) return;
      const point: LngLat = [fix.lng, fix.lat];
      const prev = s.anchor;
      const prevT = lastFixT.current;
      lastFixT.current = fix.t;
      if (!prev) {
        s.anchor = point;
        s.path.push(point);
        return;
      }
      const moved = metresBetween(prev, point);
      // Inside the accuracy circle: jitter. Keep the anchor and count nothing.
      if (moved < Math.max(MIN_STEP_M, accuracy)) return;
      const secs = Math.max(1, (fix.t - prevT) / 1000);
      const glitch = moved > MAX_STEP_M * Math.max(1, secs / 10) || moved / secs > maxSpeed;
      // With the screen open and a step counter, GPS only counts while the feet move too.
      const feetStill =
        live && hasPedometer.current && Date.now() - lastMoveAt.current > STILL_AFTER_MS;
      s.anchor = point; // re-anchor either way, so a skipped jump is never added later
      if (glitch || feetStill) return;
      s.path.push(point);
      s.metres += moved;
      if (live) lastMoveAt.current = Date.now();
      // Background fixes carry their own clock: close-together ones mean walking in between.
      else if (prevT && fix.t - prevT <= MOVING_GAP_MS) s.movingMs += fix.t - prevT;
    },
    [maxSpeed],
  );

  /** The app was asleep or closed from lastTickAt until now: work out what happened. */
  const fillGap = useCallback(
    async (now: number) => {
      const s = ref.current;
      if (!s) return;
      const from = s.lastTickAt;
      const gap = now - from;
      s.lastTickAt = now;
      if (s.status !== 'running' || gap <= GAP_MS) return;
      const before = s.movingMs;
      const fixes = s.background ? await drainFixes() : [];
      for (const f of fixes) takeFix(f, false);
      if (s.movingMs === before) {
        // No route data for the gap: Health Connect steps, else the time itself (capped).
        const steps = await stepsBetween(new Date(from), new Date(now));
        const credit =
          steps === null ? Math.min(gap, MAX_BLIND_MS) : Math.min(gap, steps * MS_PER_STEP);
        if (steps) {
          s.steps += steps;
          s.metres += steps * 0.75;
        }
        s.movingMs += credit;
        s.awayMs += credit;
      }
      publish();
    },
    [publish, takeFix],
  );

  const running = walk?.status === 'running';

  // While running: GPS, steps, and a 1 s clock (which also notices when the app slept).
  useEffect(() => {
    if (!running) return;
    let live = true;
    let gps: Location.LocationSubscription | undefined;
    let pedometer: { remove: () => void } | undefined;
    const s = ref.current!;
    void fillGap(Date.now());

    if (!s.background) {
      void Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 5 },
        ({ coords, timestamp }) => {
          if (!live) return;
          takeFix(
            { lng: coords.longitude, lat: coords.latitude, acc: coords.accuracy, t: timestamp },
            true,
          );
        },
      )
        .then((sub) => (live ? (gps = sub) : sub.remove()))
        .catch(() => setProblem('Couldn’t read your location.'));
    }

    if (Platform.OS !== 'web') {
      void Pedometer.isAvailableAsync()
        .then(async (ok) => {
          if (!ok || !(await Pedometer.requestPermissionsAsync()).granted || !live) return;
          hasPedometer.current = true;
          let seen = 0;
          pedometer = Pedometer.watchStepCount(({ steps }) => {
            const cur = ref.current;
            if (!cur || steps <= seen) return;
            cur.steps += steps - seen;
            seen = steps;
            lastMoveAt.current = Date.now();
          });
        })
        .catch(() => undefined); // steps are a bonus; the walk works without them
    }

    const clock = setInterval(() => {
      const cur = ref.current;
      if (!cur) return;
      const now = Date.now();
      if (now - cur.lastTickAt > GAP_MS) return void fillGap(now);
      // Background fixes that arrived while the screen was on (service mode).
      if (cur.background)
        void drainFixes().then((fixes) => {
          for (const f of fixes) takeFix(f, true);
        });
      const delta = now - cur.lastTickAt;
      cur.lastTickAt = now;
      const isMoving = now - lastMoveAt.current < STILL_AFTER_MS;
      if (wasMoving.current && !isMoving) cur.pauses += 1;
      wasMoving.current = isMoving;
      setMoving(isMoving);
      if (isMoving) cur.movingMs += delta;
      publish();
      // A checkpoint on the server now and then: a lost phone still has the walk so far.
      if (cur.sessionId && now - lastCheckpoint.current > CHECKPOINT_MS) {
        lastCheckpoint.current = now;
        void sessionsApi
          .checkpoint(cur.sessionId, {
            movingMs: Math.round(cur.movingMs),
            metres: Math.round(cur.metres),
            steps: cur.steps,
            pauses: cur.pauses,
            awayMs: Math.round(cur.awayMs),
            path: downsample(cur.path),
          })
          .catch(() => undefined);
      }
    }, 1000);

    // Leaving the app: save now; coming back: fill the gap straight away.
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void fillGap(Date.now());
      else if (ref.current) void saveWalk(ref.current);
    });

    return () => {
      live = false;
      clearInterval(clock);
      gps?.remove();
      pedometer?.remove();
      appState.remove();
      setMoving(false);
    };
  }, [running, fillGap, takeFix, publish]);

  const start = async (args: {
    challengeId: string | null;
    title: string;
    date: string;
    /** A workout from the Move cards: logged as this activity when finished. */
    activity?: string;
  }) => {
    if (!allowed) return;
    const now = Date.now();
    const background = await startBackgroundWalk();
    ref.current = {
      sessionId: null,
      challengeId: args.challengeId,
      title: args.title,
      date: args.date,
      status: 'running',
      startedAt: now,
      movingMs: 0,
      metres: 0,
      steps: 0,
      pauses: 0,
      awayMs: 0,
      path: [],
      lastTickAt: now,
      anchor: null,
      background,
    };
    lastMoveAt.current = now; // the first seconds count while you get going
    wasMoving.current = true;
    publish();
    // The server copy is a bonus: offline, the walk still works and logs the old way.
    try {
      const session = await sessionsApi.start({
        kind: 'walk',
        challengeId: args.challengeId ?? undefined,
        date: args.date,
        data: { title: args.title, ...(args.activity && { activity: args.activity }) },
      });
      if (ref.current) {
        ref.current.sessionId = session.id;
        publish();
      }
    } catch {
      // stays local
    }
  };

  const pause = () => {
    const s = ref.current;
    if (!s) return;
    // Standing still already counted this stop.
    if (wasMoving.current) s.pauses += 1;
    wasMoving.current = false;
    s.status = 'paused';
    publish();
  };

  const resume = () => {
    const s = ref.current;
    if (!s) return;
    s.status = 'running';
    s.lastTickAt = Date.now(); // a pause never counts as time away
    s.anchor = null; // nor as distance
    lastMoveAt.current = Date.now();
    wasMoving.current = true;
    publish();
  };

  /** Finished or thrown away: stop the service and forget the walk on this phone. */
  const clear = async () => {
    ref.current = null;
    setWalk(null);
    await stopBackgroundWalk();
    await clearWalk();
  };

  // Indoors (or with a weak signal) GPS barely moves, but the step counter does: never show
  // less distance than the steps walked (~0.75 m a step).
  const metres = walk ? Math.max(walk.metres, walk.steps * 0.75) : 0;

  return {
    walk,
    status: (walk?.status ?? 'idle') as WalkStatus,
    restored,
    path: walk?.path ?? [],
    metres,
    elapsedMs: walk?.movingMs ?? 0,
    moving,
    steps: walk && walk.steps > 0 ? walk.steps : null,
    pauses: walk?.pauses ?? 0,
    awayMs: walk?.awayMs ?? 0,
    background: walk?.background ?? false,
    problem,
    allowed,
    start,
    pause,
    resume,
    clear,
  };
}
