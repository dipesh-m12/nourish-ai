// Calendar-day helpers on 'YYYY-MM-DD' strings. Dates come from the app (the user's local day),
// so all maths here is done in UTC on plain dates to avoid timezone drift.

const DAY_MS = 24 * 60 * 60 * 1000;

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(iso: string, days: number): string {
  return toIso(new Date(toDate(iso).getTime() + days * DAY_MS));
}

/** The `n` days ending on `iso` (inclusive), oldest first. */
export function lastNDays(iso: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(iso, i - (n - 1)));
}

/** Monday of the week containing `iso`. */
export function weekStart(iso: string): string {
  const day = toDate(iso).getUTCDay(); // 0 = Sunday
  return addDays(iso, -((day + 6) % 7));
}
