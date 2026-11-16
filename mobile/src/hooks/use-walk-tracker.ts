import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import { useCallback, useEffect, useRef, useState } from 'react';
import { onlineManager } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';
import { sessionsApi } from '@/api/sessions';
import { ApiError } from '@/lib/api-client';
import { stepsBetween } from '@/lib/health';
import { drainFixes, startBackgroundWalk, stopBackgroundWalk, type RawFix } from '@/lib/walk-task';
import { metresBetween, type LngLat } from '@/utils/geo';
import { downsampleRoute } from '@/utils/route';
import { extendTrail, gpsMoving, type TrailFilter } from '@/utils/trail';

/**
 * Auto-pause: the clock stops only after this long with NO sign of moving from any source (a
 * step, the GPS's own speed, or the route moving). It used to be 8 s on steps or a 10-25 m GPS
 * jump, which at walking pace (and with Android batching steps) paused people mid-walk.
 */
const STILL_AFTER_MS = 20_000;
/** The GPS's own (Doppler) speed above this = walking, if the fix is decent. */
const MOVING_SPEED_MS = 0.6;
const SPEED_ACCURACY_M = 30;
/**
 * Distance is measured between route points at least this far apart. The drawn route keeps
 * every few metres (turns show), but summing those adds the GPS zig-zag (+15-25 %).
 */
const DISTANCE_STEP_M = 10;
/**
 * No GPS for longer than this (app closed, screen off without the background service, signal
 * lost): the route starts a new piece instead of a straight line through places not walked.
 * Shorter gaps (batched or patchy fixes) still join: a straight bit there is the best guess.
 */
const PIECE_GAP_MS = 60_000;
/**
 * The drawn route stops while the step counter says you're standing (no step this long). Shorter
 * than FEET_STILL_MS: a pause in drawing costs a short straight bit; drawing drift costs a scribble.
 */
const TRAIL_STILL_MS = 10_000;
/** Started offline: try to open the server session again this often. */
const START_RETRY_MS = 30_000;
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
  /** The route as walked, for the map and the trophy (utils/trail.ts), not for distance. */
  path: LngLat[];
  /** Where a new piece of the route starts (indexes into path): nothing is drawn across. */
  breaks?: number[];
  /** The next point starts a new piece (set by a gap or a resume). */
  newPiece?: boolean;
  /** Last route point distance was measured to (see DISTANCE_STEP_M). */
  distanceMark?: LngLat | null;
  /** The route smoother's state (missing in walks saved by older builds). */
  trail?: TrailFilter | null;
  /** Last moment the app's clock ran. */
  lastTickAt: number;
  /** Walks saved by builds before the route-based distance; no longer used. */
  anchor?: LngLat | null;
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

/**
 * Tracks a walk: route, distance, moving time, steps, stops. The walk is stored on the phone
 * (every few seconds) and on the server (every minute), so closing the app or the screen
 * sleeping never loses it. With the background service, GPS keeps collecting meanwhile; without
 * it, the gap is filled from Health Connect steps, or counted as time if there's nothing to go on
 * (and the card says so).
 *
 * Two separate uses of each GPS fix:
 * - the route on the map: every usable fix, smoothed, a point every few metres while moving
 *   (utils/trail.ts), so a lap of a lobby draws as a loop;
 * - the distance: strict, so sitting still adds nothing. With a step counter, GPS only counts
 *   while steps are coming in; without one, a fix must leave its own accuracy circle.
 */
export function useWalkTracker() {
  const [walk, setWalk] = useState<WalkState | null>(null);
  const [moving, setMoving] = useState(false);
  const [restored, setRestored] = useState<'none' | 'checking' | 'resumed'>('checking');
  const [problem, setProblem] = useState<string | null>(null);
  /** null = not asked yet. The map only shows the blue dot once this is true. */
  const [allowed, setAllowed] = useState<boolean | null>(null);

  // The live copy, mutated by GPS/step/clock callbacks; React state mirrors it once a second.
  const ref = useRef<WalkState | null>(null);
  const lastMoveAt = useRef(0);
  const lastStepAt = useRef(0);
  const wasMoving = useRef(false);
  const hasPedometer = useRef(false);
  const lastFixT = useRef(0);
  const lastCheckpoint = useRef(0);
  const lastStartTry = useRef(0);
  /**
   * A server start is in flight. Only one at a time: the server keeps one active walk and a
   * second start cancels the first, which is how walks ended up "already ended" on Finish.
   */
  const starting = useRef(false);

  const publish = useCallback(() => {
    const s = ref.current;
    // A new path array each time: the map (memoised by the React Compiler) only redraws the
    // line when the array itself changes, and the callbacks push into the live copy.
    setWalk(s ? { ...s, path: [...s.path], breaks: [...(s.breaks ?? [])] } : null);
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
        lastStepAt.current = Date.now();
        publish();
      }
      setRestored(s ? 'resumed' : 'none');
    });
  }, [publish]);

  /**
   * Opens this walk's server session, once: the in-flight flag stops the 1 s clock from
   * sending a second start (which would cancel the first). Failure = stays on the phone; the
   * clock tries again later.
   */
  const openSession = useCallback(
    async (cur: WalkState, activity?: string) => {
      if (starting.current || cur.sessionId) return;
      starting.current = true;
      lastStartTry.current = Date.now();
      try {
        const session = await sessionsApi.start({
          kind: 'walk',
          challengeId: cur.challengeId ?? undefined,
          date: cur.date,
          data: { title: cur.title, ...(activity && { activity }) },
        });
        // Still the same walk (not cleared or replaced meanwhile): keep its id.
        if (ref.current === cur && !cur.sessionId) {
          cur.sessionId = session.id;
          lastCheckpoint.current = 0; // send the walk so far straight away
          publish();
        }
      } catch {
        // stays local; retried by the clock
      } finally {
        starting.current = false;
      }
    },
    [publish],
  );

  /** Scores one GPS fix. `live` = it arrived just now with the screen open. */
  const takeFix = useCallback((fix: RawFix, live: boolean) => {
    const s = ref.current;
    if (!s || s.status !== 'running') return;
    // The route (utils/trail.ts): smoothed, a point every few metres while moving, nothing
    // while the step counter says you're standing. Distance is the route's length, so the
    // number and the line on the map always agree.
    // Standing: the step counter says so, or the walk clock has already auto-paused (no sign of
    // moving from any source for STILL_AFTER_MS), so GPS drift never draws while you stand.
    const now = Date.now();
    const standing =
      live &&
      ((hasPedometer.current && now - lastStepAt.current > TRAIL_STILL_MS) ||
        now - lastMoveAt.current > STILL_AFTER_MS);
    // A long gap since the last usable fix: the next point starts a new piece.
    if (s.trail && fix.t - s.trail.t > PIECE_GAP_MS) s.newPiece = true;
    const piece = Boolean(s.newPiece) && s.path.length > 0;
    if (piece) s.trail = null; // fresh smoothing from where you are now
    const before = s.path.length;
    s.trail = extendTrail(s.path, s.trail ?? null, fix, standing && !piece, piece);
    if (piece && s.path.length > before) {
      (s.breaks ??= []).push(before);
      s.newPiece = false;
      s.distanceMark = s.path.at(-1)!; // the gap itself is credited from steps, not GPS
    } else if (s.path.length > before) {
      const head = s.path.at(-1)!;
      const mark = s.distanceMark ?? s.path[0]!;
      const step = metresBetween(mark, head);
      if (!s.distanceMark) s.distanceMark = mark;
      if (step >= DISTANCE_STEP_M) {
        s.metres += step;
        s.distanceMark = head;
      }
    }

    // Any sign of moving keeps the clock running: the GPS's own speed, or the average position
    // moving over 10 s (steps count too, in the pedometer callback). Not "the route grew": its
    // 5 s check is tuned for drawing and drift can fool it while standing.
    const prevT = lastFixT.current;
    lastFixT.current = fix.t;
    const fast = (fix.speed ?? 0) >= MOVING_SPEED_MS && (fix.acc ?? Infinity) <= SPEED_ACCURACY_M;
    // The clock's own check runs even while "standing", so walking again restarts it.
    if (!(fast || gpsMoving(s.trail, fix.t))) return;
    if (live && hasPedometer.current && now - lastStepAt.current > TRAIL_STILL_MS) return;
    if (live) lastMoveAt.current = now;
    // Background fixes carry their own clock: close-together ones mean walking in between.
    else if (prevT && fix.t - prevT <= MOVING_GAP_MS) s.movingMs += fix.t - prevT;
  }, []);

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
      // Nothing recorded the gap: whatever comes next is a new piece of the route.
      if (!fixes.length) s.newPiece = true;
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
        // A fix a second: corners of a small loop need it (the route filters the noise).
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
        ({ coords, timestamp }) => {
          if (!live) return;
          takeFix(
            {
              lng: coords.longitude,
              lat: coords.latitude,
              acc: coords.accuracy,
              t: timestamp,
              speed: coords.speed,
            },
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
            lastStepAt.current = Date.now();
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
      // Started with no signal: open the server session once it's back (the route stays on
      // the phone meanwhile, and the next checkpoint sends all of it).
      if (
        !cur.sessionId &&
        !starting.current &&
        onlineManager.isOnline() &&
        now - lastStartTry.current > START_RETRY_MS
      )
        void openSession(cur);
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
            ...downsampleRoute(cur.path, cur.breaks),
          })
          .catch((err: unknown) => {
            // The server no longer has this walk running (ended, replaced): open a fresh one;
            // the next checkpoint sends everything, and Finish logs it.
            if (err instanceof ApiError && (err.status === 409 || err.status === 404)) {
              if (ref.current === cur) cur.sessionId = null;
              lastStartTry.current = 0;
            }
          });
      }
    }, 1000);

    // Back online: send the route now rather than at the next minute.
    const offOnline = onlineManager.subscribe((online) => {
      if (!online) return;
      lastCheckpoint.current = 0;
      lastStartTry.current = 0;
    });

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
      offOnline();
      setMoving(false);
    };
  }, [running, fillGap, takeFix, publish, openSession]);

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
      background,
    };
    lastMoveAt.current = now; // the first seconds count while you get going
    lastStepAt.current = now;
    wasMoving.current = true;
    publish();
    // The server copy is a bonus: offline, the walk still works and is sent later.
    await openSession(ref.current, args.activity);
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
    s.newPiece = true; // the route picks up from where you are now, as a new piece
    lastMoveAt.current = Date.now();
    lastStepAt.current = Date.now();
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
    breaks: walk?.breaks ?? [],
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
