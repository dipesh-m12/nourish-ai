import { addDays } from '../../utils/dates';

/** How long the user meant, as the AI read it. Code turns it into a date (the numbers rule). */
export type DurationIntent = 'today' | 'days' | 'ongoing' | 'unknown';

export const MAX_DAYS = 90;

/**
 * Last local day a challenge runs (inclusive), or null for ongoing.
 * "Today" ends tonight (endsOn = today), so tomorrow it shows as ended. N days counts today.
 * `unknown` stays open (null) and the app asks the user; `ask` tells it to.
 */
export function endsOnFor(
  today: string,
  intent: DurationIntent,
  days: number,
): { endsOn: string | null; ask: boolean } {
  switch (intent) {
    case 'today':
      return { endsOn: today, ask: false };
    case 'days': {
      const n = Math.min(Math.max(Math.round(days), 1), MAX_DAYS);
      return { endsOn: addDays(today, n - 1), ask: false };
    }
    case 'ongoing':
      return { endsOn: null, ask: false };
    default:
      return { endsOn: null, ask: true };
  }
}

/** "Keep going" extends from today if it already ended, else from its current last day. */
export function extendBy(today: string, endsOn: string | null, days: number): string | null {
  if (endsOn === null) return null;
  const from = endsOn < today ? addDays(today, -1) : endsOn;
  return addDays(from, Math.min(Math.max(Math.round(days), 1), MAX_DAYS));
}
