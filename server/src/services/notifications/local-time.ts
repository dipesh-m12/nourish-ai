import { DateTime, IANAZone } from 'luxon';

/**
 * The user's own clock, from their IANA zone. Everything time-based in nudges goes through here,
 * so "lunch", "today" and quiet hours follow the user (daylight saving and travel included).
 */

export interface LocalTime {
  /** YYYY-MM-DD in the user's zone. */
  date: string;
  hour: number;
  minute: number;
  /** Minutes east of UTC right now (what the rest of the API calls `tz`). */
  offsetMinutes: number;
}

export const isValidZone = (zone: string) => IANAZone.isValidZone(zone);

export function localTime(zone: string, now: Date = new Date()): LocalTime {
  const dt = DateTime.fromJSDate(now).setZone(zone);
  if (!dt.isValid) throw new Error(`Invalid timezone: ${zone}`);
  return { date: dt.toISODate()!, hour: dt.hour, minute: dt.minute, offsetMinutes: dt.offset };
}
