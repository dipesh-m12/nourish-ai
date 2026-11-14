/** The device's local calendar day as YYYY-MM-DD. "Today" is always the user's today, not UTC's. */
export function localDate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Single-letter weekday for a YYYY-MM-DD date (M T W T F S S). */
export function weekdayLetter(iso: string): string {
  return 'SMTWTFS'[new Date(`${iso}T00:00:00`).getDay()]!;
}

/** Calendar maths on YYYY-MM-DD strings (UTC-noon based, so DST never shifts the day). */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (to − from). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

/** "21 Nov" */
export function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}
