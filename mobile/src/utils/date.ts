/** The device's local calendar day as YYYY-MM-DD. "Today" is always the user's today, not UTC's. */
export function localDate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Single-letter weekday for a YYYY-MM-DD date (M T W T F S S). */
export function weekdayLetter(iso: string): string {
  return 'SMTWTFS'[new Date(`${iso}T00:00:00`).getDay()]!;
}
