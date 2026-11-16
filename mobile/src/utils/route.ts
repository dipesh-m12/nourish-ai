import type { LngLat } from './geo';

/**
 * A walked route is one list of points plus `breaks`: the indexes where a new piece starts
 * (after the app was closed, a long GPS gap, or a pause). Nothing is drawn across a break, so
 * a gap never shows as a straight line through places you didn't walk.
 */

/** The route as separate pieces, each drawn as its own line. */
export function segmentsOf(path: LngLat[], breaks: number[] = []): LngLat[][] {
  const cuts = [...new Set(breaks)].filter((b) => b > 0 && b < path.length).sort((a, b) => a - b);
  const out: LngLat[][] = [];
  let from = 0;
  for (const cut of [...cuts, path.length]) {
    if (cut > from) out.push(path.slice(from, cut));
    from = cut;
  }
  return out;
}

/** At most `max` points, evenly picked, always keeping the first and last. */
export function downsample(path: LngLat[], max = 1000): LngLat[] {
  if (path.length <= max) return path;
  const step = (path.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => path[Math.round(i * step)]!);
}

/**
 * Fewer points for sending or storing, piece by piece (each keeps its own ends), with the
 * breaks moved to match.
 */
export function downsampleRoute(
  path: LngLat[],
  breaks: number[] = [],
  max = 1000,
): { path: LngLat[]; breaks: number[] } {
  const pieces = segmentsOf(path, breaks);
  if (path.length <= max) return { path, breaks: pieces.length > 1 ? cutsOf(pieces) : [] };
  const kept = pieces.map((p) =>
    downsample(p, Math.max(Math.min(p.length, 2), Math.round((max * p.length) / path.length))),
  );
  return { path: kept.flat(), breaks: cutsOf(kept) };
}

/** Where each piece after the first starts in the joined list. */
function cutsOf(pieces: LngLat[][]) {
  const cuts: number[] = [];
  let at = 0;
  for (const [i, p] of pieces.entries()) {
    if (i > 0) cuts.push(at);
    at += p.length;
  }
  return cuts;
}
