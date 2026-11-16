import type { MealCredit, MealItem } from './meal';
// Mirrors server/src/services/agent/agent.service.ts.
import type { TodayChallenge } from './today';

export interface AgentAsk {
  /** reminders / week / goal: one button that opens that sheet or screen, maybe pre-filled. */
  kind: 'choice' | 'number' | 'photo' | 'challenges' | 'reminders' | 'week' | 'goal';
  /** reminders: the times the user asked for, to confirm. */
  plan?: {
    changes: { id: string; title: string; from: string | null; remindAt: string | null }[];
    water: boolean | null;
  };
  /** reminders: none set yet, so the sheet opens on times the app picks. */
  suggest?: boolean;
  /** goal: open the "+" sheet as a check-in (weight, progress). */
  context?: 'checkin';
  /** goal: the user's words, already typed in. */
  prefill?: string;
  options?: string[];
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  initial?: number;
}

export type AgentActionKind =
  | 'log_meal'
  | 'log_activity'
  | 'log_challenge'
  | 'log_sleep'
  | 'change_challenges'
  | 'create_challenges'
  | 'level_challenge'
  | 'remove_last';

/** A running challenge one step harder or easier, from today. */
export interface LevelCard {
  id: string;
  title: string;
  from: number;
  to: number;
  unit: string | null;
  direction: 'up' | 'down';
}

/** Challenges proposed from a report, saved on confirm. */
export interface CreateChallengesCard {
  items: { title: string; target: string; why: string; endsOn: string | null }[];
}

export interface AgentAction {
  id: string;
  kind: AgentActionKind;
  status: 'proposed' | 'confirmed' | 'cancelled' | 'expired' | 'failed';
  /** The card's contents, computed on the server (shape depends on `kind`). */
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  needsPhoto: boolean;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  ask: AgentAsk | null;
  action: AgentAction | null;
  createdAt: string;
}

export interface AgentUsage {
  sent: number;
  free: number;
}

export interface AgentThread {
  conversationId: string;
  messages: AgentMessage[];
  usage: AgentUsage;
}

export type ConfirmResult = { ok: true; messages: AgentMessage[] } | { ok: false; note: string };

// Card contents per action kind (computed on the server).
export interface MealCard {
  title: string;
  items: MealItem[];
  comment: string;
  credits: MealCredit[];
  totals: { calories: number; proteinG: number; carbsG: number; fatG: number };
  conflicts: { item: string; message: string }[];
}
export interface ActivityCard {
  label: string;
  minutes: number | null;
  calories: number | null;
  previewKcal: number;
}
export interface ChallengeCard {
  challengeId: string;
  /** Snapshot for stored cards; the current dashboard query takes priority. */
  challenge?: TodayChallenge;
  label: string;
  check: boolean;
  unit: string | null;
  amount: number;
  progress: { value: number; goal: number };
}
export interface SleepCard {
  hours: number;
  previewKcal: number;
}
export interface ChangeCard {
  accept: { id: string; title: string }[];
  drop: { id: string; title: string }[];
}
export interface RemoveCard {
  target: 'meal' | 'activity';
  title: string;
  calories: number;
}
