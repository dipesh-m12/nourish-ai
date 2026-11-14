import type { TodayChallenge } from '@/types/today';

/**
 * How a challenge is logged, so each habit gets its own interaction instead of one generic sheet.
 * Decided from the stored tracking spec (the server picks unit/kind; this only reads it).
 */
export type ChallengeFormat =
  'water' | 'timer' | 'walk' | 'place' | 'sleep' | 'tally' | 'amount' | 'check';

/** Showing up somewhere is the habit: the gym, the park, a class. */
const PLACE = /\b(gym|park|temple|library|class|studio|pool|ground)\b|go to|visit|reach/i;

const LITRES = /^(l|litres?|liters?|ml|glass(es)?|cups?)$/i;
const MINUTES = /^(min|mins|minutes?)$/i;
/** Outdoor movement that a map can follow, measured in time or distance. */
const ROUTE = /walk|run|jog|hike|stroll|cycl|ride/i;
const DISTANCE = /^km$/i;
const HOURS = /^(h|hrs?|hours?)$/i;
/** Things you count one at a time: a tap per set, serving, page, round. */
const COUNTS =
  /^(sets?|reps?|times|servings?|portions?|pages?|rounds?|sessions?|fruits?|bowls?|cups? of \w+)$/i;
const TIMED = /breath|medita|pranayam|plank|stretch|yoga|mindful|calm/i;

export function formatFor(c: TodayChallenge): ChallengeFormat {
  const unit = c.tracking.unit ?? '';
  // "1 visit" comes back as an amount of 1, so a one-off target counts as a check-in too.
  const oneOff = c.tracking.kind === 'check' || c.progress.goal <= 1;
  if (c.place || (oneOff && PLACE.test(c.title))) return 'place';
  if (c.tracking.kind === 'check') return 'check';
  if (c.category === 'hydration' || LITRES.test(unit)) return 'water';
  if (MINUTES.test(unit) && (c.category === 'mindset' || TIMED.test(c.title))) return 'timer';
  const route = ROUTE.test(c.title) && (MINUTES.test(unit) || DISTANCE.test(unit));
  if (c.category === 'movement' && (/^steps$/i.test(unit) || route)) return 'walk';
  if (c.category === 'sleep' && HOURS.test(unit)) return 'sleep';
  if (COUNTS.test(unit)) return 'tally';
  return 'amount';
}

/** Challenges Health Connect can fill in by itself: step counts and hours of sleep. */
export function autoSource(c: TodayChallenge): 'steps' | 'sleep' | null {
  const unit = (c.tracking.unit ?? '').toLowerCase();
  if (unit === 'steps') return 'steps';
  if (c.category === 'sleep' && /^(h|hrs?|hours?)$/.test(unit)) return 'sleep';
  return null;
}
