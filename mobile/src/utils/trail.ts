import { metresBetween, type LngLat } from './geo';

/**
 * The route as drawn on the map: where you actually walked, point by point.
 *
 * Kept apart from distance counting on purpose. Distance needs strict jitter rules (a fix only
 * counts once it leaves its accuracy circle), which on a small loop keeps only the start point,
 * and the map then drew one straight line. The trail takes every usable fix instead, smoothed
 * by a small Kalman filter (each fix weighted by its own accuracy), and adds a point every few
 * metres, so a lap of a lobby comes out as a loop.
 */

/** Fixes worse than this would scribble on the map (indoors they can be 50 m off). */
export const TRAIL_MAX_ACCURACY_M = 35;
/** A new point every few metres: smooth enough for a loop, light enough to store. */
export const TRAIL_STEP_M = 3;
/** How fast the true position may change between fixes (walking, with turns), m/s. */
const PROCESS_MS = 3;
/** A fix this far from the smoothed position this fast is a glitch, not a walk. */
const MAX_JUMP_MS = 10;
/**
 * Moving, from GPS alone: the average position of the last MOVE_WINDOW_MS against the window
 * before it. Averaging cancels most jitter; walking moves the average ~6 m, standing still it
 * stays within a few. (Without a check like this, drift drew ~70 m in two minutes standing.)
 * The step counter, when live, is the stronger signal and decides first (see `still`).
 */
const MOVE_WINDOW_MS = 5000;
const MOVE_MIN_M = 4.5;

/** The smoother's state: the best guess of where you are, and how sure it is (m²). */
export interface TrailFilter {
  lng: number;
  lat: number;
  variance: number;
  t: number;
  /** Raw fixes of the last two windows [lng, lat, t], for the moving check. */
  recent?: [number, number, number][];
}

export interface TrailFix {
  lng: number;
  lat: number;
  /** Accuracy radius in metres (null = unknown). */
  acc: number | null;
  /** Milliseconds since epoch. */
  t: number;
}

/** One Kalman step: moves the guess towards the fix, more for accurate fixes. */
export function smooth(filter: TrailFilter | null, fix: TrailFix): TrailFilter {
  const acc = Math.max(fix.acc ?? TRAIL_MAX_ACCURACY_M, 3);
  if (!filter) return { lng: fix.lng, lat: fix.lat, variance: acc * acc, t: fix.t, recent: [] };
  const dt = Math.max(0, (fix.t - filter.t) / 1000);
  const variance = filter.variance + dt * PROCESS_MS * PROCESS_MS;
  const k = variance / (variance + acc * acc);
  return {
    lng: filter.lng + k * (fix.lng - filter.lng),
    lat: filter.lat + k * (fix.lat - filter.lat),
    variance: (1 - k) * variance,
    t: fix.t,
    recent: filter.recent,
  };
}

/**
 * Feeds one fix to the trail (mutates `trail`, returns the new filter). Inaccurate fixes and
 * glitches are skipped; a point is added once the smoothed position has moved TRAIL_STEP_M.
 */
export function extendTrail(
  trail: LngLat[],
  filter: TrailFilter | null,
  fix: TrailFix,
  /** true = the step counter is live and no steps came in lately: standing, draw nothing. */
  still = false,
): TrailFilter | null {
  if ((fix.acc ?? Infinity) > TRAIL_MAX_ACCURACY_M) return filter;
  if (filter) {
    const secs = Math.max(1, (fix.t - filter.t) / 1000);
    const jump = metresBetween([filter.lng, filter.lat], [fix.lng, fix.lat]);
    if (jump / secs > MAX_JUMP_MS) return filter;
  }
  const next = smooth(filter, fix);
  const point: LngLat = [next.lng, next.lat];
  // Raw fixes of the last two windows, oldest first.
  const recent = (next.recent ?? []).filter(([, , t]) => fix.t - t < 2 * MOVE_WINDOW_MS);
  recent.push([fix.lng, fix.lat, fix.t]);
  next.recent = recent;
  const last = trail.at(-1);
  if (!last) {
    trail.push(point);
    return next;
  }
  if (!still && movedLately(recent, fix.t) && metresBetween(last, point) >= TRAIL_STEP_M)
    trail.push(point);
  return next;
}

/** The average position of this window moved MOVE_MIN_M from the one before it. */
function movedLately(recent: [number, number, number][], now: number) {
  const nowWin = recent.filter(([, , t]) => now - t < MOVE_WINDOW_MS);
  const before = recent.filter(([, , t]) => now - t >= MOVE_WINDOW_MS);
  if (nowWin.length < 2 || before.length < 2) return false;
  const mean = (w: [number, number, number][]): LngLat => [
    w.reduce((a, p) => a + p[0], 0) / w.length,
    w.reduce((a, p) => a + p[1], 0) / w.length,
  ];
  return metresBetween(mean(before), mean(nowWin)) >= MOVE_MIN_M;
}

/** Length of a drawn route, in metres. */
export function trailLength(trail: LngLat[]) {
  let m = 0;
  for (let i = 1; i < trail.length; i++) m += metresBetween(trail[i - 1]!, trail[i]!);
  return m;
}
