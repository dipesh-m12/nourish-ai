// Mirrors server/src/services/agent/agent.service.ts.

export interface AgentAsk {
  kind: 'choice' | 'number';
  options?: string[];
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  initial?: number;
}

export type AgentActionKind =
  'log_meal' | 'log_activity' | 'log_challenge' | 'log_sleep' | 'change_challenges' | 'remove_last';

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
  items: { name: string; portion: string; calories: number }[];
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
