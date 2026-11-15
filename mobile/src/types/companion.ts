import type { RoomItem } from '@/constants/mochi-room';

// Mirrors the `companion` block of GET /me/today (server/src/services/challenges/…).

export type CompanionMood = 'happy' | 'normal' | 'sad' | 'left';

export interface Companion {
  name: string;
  /** undecided → show "Adopt a cat"; declined → show nothing. */
  status: 'undecided' | 'adopted' | 'declined' | 'left';
  introSeen: boolean;
  mood: CompanionMood | null;
  line: string | null;
  /** Adopted only: her room (server: companion/room.rules.ts). */
  room?: {
    /** The first N of ROOM_ITEMS are hers. */
    unlocked: number;
    /** Full days so far this week, out of the `need` that earns the next item. */
    full: number;
    need: number;
    newItem: RoomItem | null;
  };
}
