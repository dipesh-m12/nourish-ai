// Mirrors server/src/services/briefing/briefing.service.ts.

export type BriefingAction =
  | { kind: 'log_meal'; label: string }
  | { kind: 'log_challenge'; label: string; challengeId: string }
  | { kind: 'ask'; label: string; prompt: string };

export interface Briefing {
  kind:
    | 'all_done'
    | 'sleep'
    | 'meal_time'
    | 'over'
    | 'near_limit'
    | 'protein_short'
    | 'water_behind'
    | 'streak_risk'
    | 'open_challenges'
    | 'on_track';
  greeting: string;
  /** The one thing that matters now (rule-written, exact numbers). */
  headline: string;
  /** Ties it to the user's own reason (AI-written when available). */
  why: string;
  /** A habit from the last week, e.g. "Salad: 2 of 7 days". */
  week: string | null;
  actions: BriefingAction[];
  voice: 'ai' | 'rules';
}
