import type { ActivityKind, Challenge, ChallengeTracking } from '../../db/schema';

/**
 * Calories burned, from the Compendium of Physical Activities: kcal = MET × kg × hours.
 * Active calories are the part ABOVE resting (MET − 1), like a watch's "active energy",
 * so they never double-count the resting burn that's already in the day.
 */
export const MET: Record<ActivityKind, number> = {
  walk: 3.5,
  brisk_walk: 4.3,
  run: 9.8,
  cycle: 7.5,
  yoga: 2.5,
  stretch: 2.3,
  strength: 5.0,
  dance: 5.5,
  sport: 5.5,
  swim: 6.0,
  chores: 3.3,
  cardio: 7.0,
  plyometrics: 8.0,
  sleep: 0.95,
};

/** Hours of sleep we'll accept from one log (more is almost surely a typo). */
export const MAX_SLEEP_HOURS = 14;
/** Minutes of activity we'll accept from one log. */
export const MAX_ACTIVITY_MINUTES = 600;

export function activeKcal(kind: Exclude<ActivityKind, 'sleep'>, minutes: number, kg: number) {
  return activeKcalAt(MET[kind], minutes, kg);
}

/** Same rule with an explicit MET (e.g. a specific exercise from the library). */
export function activeKcalAt(met: number, minutes: number, kg: number) {
  return Math.round(Math.max(0, met - 1) * kg * (minutes / 60));
}

export function sleepKcal(minutes: number, kg: number) {
  return Math.round(MET.sleep * kg * (minutes / 60));
}

export interface DayBurnInput {
  /** Resting kcal per 24 h (Mifflin–St Jeor). */
  bmr: number;
  sleepMinutes: number;
  sleepCalories: number;
  activeCalories: number;
}

/**
 * The whole day: breathing and body upkeep for the hours awake, sleep for the hours asleep,
 * plus active. Splitting the 24 h this way means logging sleep re-labels hours, never adds
 * them twice.
 */
export function dayBurn({ bmr, sleepMinutes, sleepCalories, activeCalories }: DayBurnInput) {
  const sleptHours = Math.min(24, sleepMinutes / 60);
  const resting = Math.round((bmr / 24) * (24 - sleptHours));
  return {
    resting,
    sleep: sleepCalories,
    active: activeCalories,
    total: resting + sleepCalories + activeCalories,
    restingPerHour: Math.round(bmr / 24),
  };
}

const KIND_RULES: [RegExp, Exclude<ActivityKind, 'sleep'>][] = [
  [/run|jog/, 'run'],
  [/cycl|bike/, 'cycle'],
  [/yoga/, 'yoga'],
  [/stretch/, 'stretch'],
  [/strength|workout|gym|squat|push.?up|plank|weights/, 'strength'],
  [/danc|zumba/, 'dance'],
  [/swim/, 'swim'],
  [/brisk/, 'brisk_walk'],
  [/walk|stroll|steps/, 'walk'],
];

/**
 * A verified movement or sleep challenge log as an activity, so the burn moves with the
 * challenge. Returns null when the unit can't be turned into time (e.g. "reps").
 */
export function activityFromChallenge(
  c: Pick<Challenge, 'title' | 'category'>,
  t: ChallengeTracking,
  amount: number,
): { kind: ActivityKind; minutes: number } | null {
  const unit = (t.unit ?? '').toLowerCase();
  if (c.category === 'sleep') {
    if (!/^(h|hrs?|hours?)$/.test(unit)) return null; // e.g. "wind down 30 min" isn't sleep
    return { kind: 'sleep', minutes: Math.min(amount, MAX_SLEEP_HOURS) * 60 };
  }
  if (c.category !== 'movement') return null;

  const title = c.title.toLowerCase();
  const kind = KIND_RULES.find(([re]) => re.test(title))?.[1] ?? 'walk';
  const minutes = toMinutes(kind, unit, amount);
  return minutes ? { kind, minutes: Math.min(minutes, MAX_ACTIVITY_MINUTES) } : null;
}

function toMinutes(kind: ActivityKind, unit: string, amount: number): number | null {
  if (/^(min|mins|minutes?)$/.test(unit)) return amount;
  if (/^(h|hrs?|hours?)$/.test(unit)) return amount * 60;
  if (unit === 'km') return amount * (kind === 'run' ? 6 : kind === 'cycle' ? 3 : 12);
  if (unit === 'steps') return amount / 100; // ~100 steps a minute
  if (/^(times|sessions?)$/.test(unit)) return amount * 20; // a short session
  if (unit === 'sets') return amount * 2;
  return null;
}
