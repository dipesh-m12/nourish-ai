// Mirrors server/src/services/week/week.rules.ts → WeekReview.
export interface WeekStat {
  key: 'days' | 'protein' | 'move' | 'sleep' | 'kcal';
  label: string;
  now: string;
  before: string | null;
  better: boolean | null;
}

export interface WeekReview {
  trend: 'up' | 'down' | 'steady' | 'first';
  headline: string;
  stats: WeekStat[];
  best: string | null;
  /** A full week on the best habit: its next step, one tap. */
  levelUp: GoalChange | null;
  /** `ease` = one step down in one tap; null = ask Nourish with `prompt`. */
  focus: { label: string; prompt: string; ease: GoalChange | null } | null;
  /** Health areas from their reports, latest against the report before (server: markerTrends). */
  reports: MarkerTrend[];
}

/** A goal change the server worked out: from → to, starting tomorrow. */
export interface GoalChange {
  challengeId: string;
  label: string;
  from: number;
  to: number;
  unit: string | null;
}

export type MarkerFlag = 'low' | 'high' | 'normal';

export interface MarkerTrend {
  area: string;
  label: string;
  /** What it's for, said after "for": "energy", "your heart". */
  feel: string;
  now: MarkerFlag;
  before: MarkerFlag | null;
  trend: 'better' | 'worse' | 'same' | 'new';
}
