// Mirrors the `companion` block of GET /me/today (server/src/services/challenges/…).

export type CompanionMood = 'happy' | 'normal' | 'sad' | 'left';

export interface Companion {
  name: string;
  /** undecided → show "Adopt a cat"; declined → show nothing. */
  status: 'undecided' | 'adopted' | 'declined' | 'left';
  introSeen: boolean;
  mood: CompanionMood | null;
  line: string | null;
}
