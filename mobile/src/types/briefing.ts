// Mirrors server/src/services/briefing/briefing.service.ts.

export type BriefingAction =
  | { kind: 'log_meal'; label: string }
  | { kind: 'log_challenge'; label: string; challengeId: string }
  | { kind: 'ask'; label: string; prompt: string }
  /** Start one of the plan's ideas. */
  | { kind: 'add_challenge'; label: string; challengeId: string }
  /** Raise a challenge's goal one step, from today. */
  | { kind: 'level_up'; label: string; challengeId: string }
  /** Open the "+" sheet as a check-in (the AI knows it's a progress update). */
  | { kind: 'checkin'; label: string };

export interface Briefing {
  kind:
    | 'all_done'
    | 'sleep'
    | 'meal_time'
    | 'over'
    | 'near_limit'
    | 'priority'
    | 'protein_short'
    | 'water_behind'
    | 'streak_risk'
    | 'open_challenges'
    | 'suggest'
    | 'level_up'
    | 'checkin'
    | 'on_track';
  greeting: string;
  /** The one thing that matters now (rule-written, exact numbers). */
  headline: string;
  /** Ties it to the user's own reason (AI-written when available). */
  why: string;
  /** A habit from the last week, e.g. "Salad: 2 of 7 days". */
  week: string | null;
  actions: BriefingAction[];
  /** A challenge the PA offers: a row on the card that opens to its why and "Add it". */
  suggestion: { id: string; title: string; target: string; why: string } | null;
  voice: 'ai' | 'rules';
}
