import { addDays, weekStart } from '../../utils/dates';
import { type DailyHistory, perfectDay } from './companion.rules';

/**
 * Mochi's room: each good week (5 of 7 full days: a rest day or two still counts) adds the next
 * item to her room. Slow and kind on purpose: it rewards weeks, not taps, so one big day can't
 * buy it and one bad day can't take it away. Items are never lost. Pure.
 */

/** In unlock order. The app draws each one (components/companion/mochi-room.tsx). */
export const ROOM_ITEMS = [
  'rug',
  'cushion',
  'plant',
  'yarn',
  'frame',
  'lamp',
  'shelf',
  'lights',
] as const;
export type RoomItem = (typeof ROOM_ITEMS)[number];

/** Full days a week needs to count. */
export const GOOD_DAYS = 5;
/** How far back the day history reaches (the dashboard's 4-week timeline). */
const HISTORY_DAYS = 28;

export interface RoomState {
  /** How many items are unlocked (the first N of ROOM_ITEMS). */
  items: number;
  /** The last week end (a Sunday) already counted; null = none yet. */
  through: string | null;
  /** The day the newest item arrived (Mochi mentions it for a couple of days). */
  newAt?: string;
}

export interface RoomView {
  unlocked: number;
  /** Full days so far this week, and how many the week needs. */
  full: number;
  need: number;
  /** The item that arrived in the last two days, if any. */
  newItem: RoomItem | null;
}

const fullDays = (daily: DailyHistory[], from: string, to: string) => {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (perfectDay(daily, d)) n++;
  return n;
};

/**
 * Counts every finished week (Mon–Sun) since adoption that isn't counted yet, as far back as
 * the history reaches. Returns the new state and whether it changed (so the caller saves it).
 */
export function updateRoom(
  state: RoomState | undefined,
  daily: DailyHistory[],
  today: string,
  adoptedOn: string,
): { state: RoomState; changed: boolean } {
  const prev: RoomState = state ?? { items: 0, through: null };
  const lastEnd = addDays(weekStart(today), -1); // the Sunday before this week
  const oldest = addDays(today, -(HISTORY_DAYS - 1));
  let { items } = prev;
  let newAt = prev.newAt;
  // From the week after the last one counted (or the adoption week; a partial one is skipped).
  let end = prev.through ? addDays(prev.through, 7) : addDays(weekStart(adoptedOn), 6);
  for (; end <= lastEnd; end = addDays(end, 7)) {
    const start = addDays(end, -6);
    if (start < adoptedOn || start < oldest) continue;
    if (items < ROOM_ITEMS.length && fullDays(daily, start, end) >= GOOD_DAYS) {
      items++;
      newAt = today;
    }
  }
  const through = lastEnd >= addDays(weekStart(adoptedOn), 6) ? lastEnd : prev.through;
  const next: RoomState = { items, through, ...(newAt && { newAt }) };
  const changed =
    next.items !== prev.items || next.through !== prev.through || next.newAt !== prev.newAt;
  return { state: next, changed };
}

/** What the app shows: the room so far and this week's way to the next item. */
export function roomView(state: RoomState, daily: DailyHistory[], today: string): RoomView {
  const fresh = state.newAt !== undefined && state.newAt >= addDays(today, -1);
  return {
    unlocked: state.items,
    full: fullDays(daily, weekStart(today), today),
    need: GOOD_DAYS,
    newItem: fresh && state.items > 0 ? ROOM_ITEMS[state.items - 1]! : null,
  };
}

/** "a cushion", "lights" */
export const itemName: Record<RoomItem, string> = {
  rug: 'a rug',
  cushion: 'a cushion',
  plant: 'a plant',
  yarn: 'a ball of yarn',
  frame: 'a picture',
  lamp: 'a lamp',
  shelf: 'a shelf',
  lights: 'fairy lights',
};
