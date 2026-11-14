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
  focus: { label: string; prompt: string } | null;
  /** Health areas from their reports, latest against the report before (server: markerTrends). */
  reports: MarkerTrend[];
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
