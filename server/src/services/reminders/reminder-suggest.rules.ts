/**
 * A ready-made reminder plan the user only has to confirm: one sensible time per daily habit
 * that has none yet, picked by what the habit is. Pure, so it's easy to test.
 */

export interface SuggestInput {
  id: string;
  title: string;
  category: string;
  frequency: 'daily' | 'weekly';
  remindAt: string | null;
}

export interface ReminderSuggestion {
  reply: string;
  changes: { id: string; title: string; from: null; remindAt: string }[];
  /** Turn water sips on (null = leave as is). */
  water: true | null;
}

/** When each kind of habit is easiest to act on. */
const TIME_FOR: Record<string, string> = {
  movement: '18:30', // after work, before dinner
  nutrition: '12:30', // just before lunch
  mindset: '21:00', // winding down
  sleep: '22:00', // half an hour before bed
};
const DEFAULT_TIME = '09:00';
/** Two habits on the same time get spread out by this much. */
const SPREAD_MIN = 30;

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h! * 60 + m!;
};
const toHHMM = (min: number) =>
  `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export function suggestReminders(list: SuggestInput[], waterOn: boolean): ReminderSuggestion {
  const taken = new Set(list.filter((c) => c.remindAt).map((c) => toMin(c.remindAt!)));
  const changes: ReminderSuggestion['changes'] = [];
  let water: true | null = null;

  for (const c of list) {
    if (c.frequency !== 'daily' || c.remindAt) continue;
    // Water is nudged through the day by sips, not one fixed time.
    if (c.category === 'hydration') {
      if (!waterOn) water = true;
      continue;
    }
    let at = toMin(TIME_FOR[c.category] ?? DEFAULT_TIME);
    while (taken.has(at)) at += SPREAD_MIN;
    taken.add(at);
    changes.push({ id: c.id, title: c.title, from: null, remindAt: toHHMM(at) });
  }
  changes.sort((a, b) => a.remindAt.localeCompare(b.remindAt));

  const n = changes.length + (water ? 1 : 0);
  return {
    reply: n ? 'I picked a time for each. Tap one to change it.' : 'Your reminders are all set.',
    changes,
    water,
  };
}
