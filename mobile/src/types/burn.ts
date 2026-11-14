// Mirrors server/src/services/burn/burn.service.ts → forDay().

export type ActivityKind =
  | 'walk'
  | 'brisk_walk'
  | 'run'
  | 'cycle'
  | 'yoga'
  | 'stretch'
  | 'strength'
  | 'dance'
  | 'sport'
  | 'swim'
  | 'chores'
  | 'cardio'
  | 'plyometrics'
  | 'sleep';

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  label: string;
  minutes: number;
  calories: number;
  /** Made by a challenge log (removed with it, not on its own). */
  fromChallenge: boolean;
  /** A tracked walk: tapping the row opens its trophy card. */
  sessionId: string | null;
  createdAt: string;
}

export interface Burn {
  /** Breathing and body upkeep for the hours awake. */
  resting: number;
  sleep: number;
  /** Above resting, like a watch's "active energy". */
  active: number;
  total: number;
  restingPerHour: number;
  sleepMinutes: number;
  /** Each day's whole burn (body + sleep + active); `active` alone kept for history. */
  week: { date: string; active: number; total: number }[];
  activities: ActivityEntry[];
}

export type LogActivityResult =
  | {
      verified: true;
      note: string | null;
      activity: ActivityEntry;
      /** The matching challenge it also counted toward, if any. */
      credited: { challengeId: string; label: string; amount: number } | null;
    }
  | { verified: false; note: string };
