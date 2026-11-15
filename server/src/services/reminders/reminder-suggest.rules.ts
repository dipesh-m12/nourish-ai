/**
 * A ready-made reminder plan the user only has to confirm: one sensible time per daily habit
 * that has none yet, picked by what the habit is. Pure, so it's easy to test.
 */

export interface SuggestInput {
  id: string;
  title: string;
  /** "20 min", "11 pm"…: may carry a time of its own. */
  target: string;
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

/**
 * The habit's own words decide first ("Morning walk" is a morning reminder), in this order, so
 * "after dinner walk" is an evening one and "breakfast" beats "morning".
 */
const WORDS: [RegExp, string][] = [
  [/\b(before bed|bedtime|lights? out|wind down|no screens?|sleep by)\b/, '21:30'],
  [/\bafter dinner\b/, '20:30'],
  [/\bdinner\b/, '19:30'],
  [/\b(evening|after work|sunset)\b/, '18:30'],
  [/\bsnacks?\b/, '16:30'],
  [/\b(afternoon|post[- ]lunch|after lunch)\b/, '14:30'],
  [/\b(lunch|midday|noon)\b/, '12:30'],
  [/\bbreakfast\b/, '08:00'],
  [/\b(morning|sunrise|wake|waking|am walk)\b/, '07:00'],
  [/\bnight\b/, '21:30'],
];

/** A clock time in the words ("11 pm", "7:30 am", "by 10pm"), in minutes. */
function clockIn(text: string): number | null {
  const m = /\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/.exec(text);
  if (!m) return null;
  const h = (Number(m[1]) % 12) + (m[3] === 'pm' ? 12 : 0);
  return h * 60 + Number(m[2] ?? 0);
}

/** A nudge before the habit's own time: half an hour before bed, else 15 minutes. */
function timeFor(c: SuggestInput): number {
  const text = `${c.title} ${c.target}`.toLowerCase();
  const clock = clockIn(text);
  if (clock !== null) return (clock - (c.category === 'sleep' ? 30 : 15) + 1440) % 1440;
  const word = WORDS.find(([re]) => re.test(text));
  return toMin(word?.[1] ?? TIME_FOR[c.category] ?? DEFAULT_TIME);
}

/** Without a hint in the words: when each kind of habit is easiest to act on. */
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
    let at = timeFor(c);
    while (taken.has(at)) at = (at + SPREAD_MIN) % 1440;
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
