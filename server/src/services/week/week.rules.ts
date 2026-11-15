/**
 * The weekly check-in: is my health actually improving? (the reviewer's biggest point).
 * Pure: this week vs last week, computed in code. It picks one headline, at most three
 * comparisons that changed, the best habit, and the one to work on with a ready-made ask.
 */

export interface WeekTotals {
  /** Days with at least one challenge running. */
  activeDays: number;
  /** Days where every running daily challenge was done. */
  fullDays: number;
  /** Days with food logged, and their averages. */
  loggedDays: number;
  avgKcal: number;
  avgProteinG: number;
  activeMinutes: number;
  /** Nights with sleep logged, and their average hours. */
  sleepNights: number;
  avgSleepH: number;
}

export interface HabitWeek {
  label: string;
  done: number;
  active: number;
  /** For one-tap goal changes (optional: older callers and tests may leave them out). */
  id?: string;
  unit?: string | null;
  /** Today's goal, and the next one up / down when the habit can move (null = it can't). */
  goal?: number;
  up?: number | null;
  down?: number | null;
}

/** A one-tap goal change: from → to, starting tomorrow. */
export interface GoalChange {
  challengeId: string;
  label: string;
  from: number;
  to: number;
  unit: string | null;
}

export interface WeekInput {
  name: string;
  targets: { calories: number; proteinG: number };
  thisWeek: WeekTotals;
  lastWeek: WeekTotals;
  habits: HabitWeek[];
}

export interface WeekStat {
  key: 'days' | 'protein' | 'move' | 'sleep' | 'kcal';
  label: string;
  now: string;
  before: string | null;
  /** Did it move the right way? null = no comparison yet. */
  better: boolean | null;
}

export interface WeekReview {
  trend: 'up' | 'down' | 'steady' | 'first';
  headline: string;
  stats: WeekStat[];
  best: string | null;
  /** Every day this week: the step up, ready to take. */
  levelUp: GoalChange | null;
  /** `ease` = the step down in one tap when the habit can move; else the prompt asks Nourish. */
  focus: { label: string; prompt: string; ease: GoalChange | null } | null;
}

const round = (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d;

/** How close to target (1 = on it). Over or under both count as off. */
const kcalCloseness = (avg: number, target: number) =>
  target ? 1 - Math.min(1, Math.abs(avg - target) / target) : 0;

export function buildWeek(i: WeekInput): WeekReview {
  const t = i.thisWeek;
  const l = i.lastWeek;
  const first = l.activeDays === 0 && l.loggedDays === 0;
  const stats: WeekStat[] = [];

  if (t.activeDays) {
    stats.push({
      key: 'days',
      label: 'Full days',
      now: `${t.fullDays} of ${t.activeDays}`,
      before: l.activeDays ? `${l.fullDays} of ${l.activeDays}` : null,
      better: l.activeDays ? t.fullDays / t.activeDays >= l.fullDays / l.activeDays : null,
    });
  }
  if (t.loggedDays && i.targets.proteinG) {
    stats.push({
      key: 'protein',
      label: 'Protein a day',
      now: `${round(t.avgProteinG)} g`,
      before: l.loggedDays ? `${round(l.avgProteinG)} g` : null,
      better: l.loggedDays
        ? Math.abs(t.avgProteinG - i.targets.proteinG) <=
          Math.abs(l.avgProteinG - i.targets.proteinG)
        : null,
    });
  }
  if (t.activeMinutes || l.activeMinutes) {
    stats.push({
      key: 'move',
      label: 'Active',
      now: `${t.activeMinutes} min`,
      before: first ? null : `${l.activeMinutes} min`,
      better: first ? null : t.activeMinutes >= l.activeMinutes,
    });
  }
  if (t.sleepNights) {
    stats.push({
      key: 'sleep',
      label: 'Sleep a night',
      now: `${round(t.avgSleepH, 1)} h`,
      before: l.sleepNights ? `${round(l.avgSleepH, 1)} h` : null,
      better: l.sleepNights ? t.avgSleepH >= l.avgSleepH : null,
    });
  }
  if (stats.length < 3 && t.loggedDays) {
    stats.push({
      key: 'kcal',
      label: 'Calories a day',
      now: `${round(t.avgKcal)}`,
      before: l.loggedDays ? `${round(l.avgKcal)}` : null,
      better: l.loggedDays
        ? kcalCloseness(t.avgKcal, i.targets.calories) >=
          kcalCloseness(l.avgKcal, i.targets.calories)
        : null,
    });
  }

  const shown = stats.slice(0, 3);
  const compared = shown.filter((s) => s.better !== null);
  const ups = compared.filter((s) => s.better).length;
  const trend: WeekReview['trend'] = !compared.length
    ? 'first'
    : ups > compared.length / 2
      ? 'up'
      : ups < compared.length / 2
        ? 'down'
        : 'steady';

  // Feeling first, then the fact (no grams in the headline).
  const headline =
    trend === 'first'
      ? `Week one, ${i.name}. Here's where you start.`
      : trend === 'up'
        ? 'You’re getting stronger. This week beat the last.'
        : trend === 'down'
          ? 'A softer week. One small change gets it back.'
          : 'Steady week. Keep the rhythm going.';

  const rated = i.habits
    .filter((h) => h.active > 0)
    .map((h) => ({ ...h, rate: h.done / h.active }));
  const sorted = [...rated].sort((a, b) => b.rate - a.rate);
  const top = sorted[0] && sorted[0].rate > 0 ? sorted[0] : null;
  const best = top?.label ?? null;
  const change = (h: (typeof rated)[number], to: number | null | undefined): GoalChange | null =>
    h.id && h.goal !== undefined && to != null
      ? { challengeId: h.id, label: h.label, from: h.goal, to, unit: h.unit ?? null }
      : null;
  // A full week, every day, on a habit that can grow (water and sleep can't): the next step.
  const perfect = rated.find((h) => h.active >= 7 && h.done === h.active && h.up != null);
  const levelUp = perfect ? change(perfect, perfect.up) : null;
  const worst = sorted.length > 1 ? sorted[sorted.length - 1]! : null;
  // Judge a habit only after a few days (day one, today still open, is not "missing" it).
  const focus =
    worst && worst.active >= 3 && worst.rate < 0.6
      ? {
          label: worst.label,
          prompt: `I keep missing "${worst.label}" (${worst.done} of ${worst.active} days). Make it easier for me.`,
          ease: change(worst, worst.down),
        }
      : null;

  return { trend, headline, stats: shown, best, levelUp, focus };
}
