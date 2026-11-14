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
}
