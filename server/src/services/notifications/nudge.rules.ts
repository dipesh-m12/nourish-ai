import type { BriefingAction, BriefingKind } from '../briefing/briefing.rules';

/**
 * Should we push the user right now, and with what? Pure (no I/O): the briefing rules already
 * picked the one thing that matters; this decides if it's worth interrupting for, and when.
 *
 * Principles: the user's local clock, never at night, at most a few a day, never the same nudge
 * twice in a day, never while they're already in the app, and never to nag (no "you're over").
 * Copy leads with how it helps (the reviewer's Vitamin D point), the rule's numbers come second.
 */

export const QUIET_FROM = 22;
export const QUIET_TO = 7;
/** Safety ceiling. Was 3; raised while water reminders are tested (each is opt-in). */
export const MAX_PER_DAY = 12;
/** Opened the app this recently = they've seen the briefing card already. */
export const ACTIVE_GRACE_MIN = 30;

export interface NudgeInput {
  hour: number;
  briefing: { kind: BriefingKind; headline: string; actions: BriefingAction[] };
  /** Keys already sent in the user's current local day. */
  sentToday: string[];
  /** Minutes since the app was last opened (null = unknown). */
  minutesSinceActive: number | null;
}

export interface Nudge {
  /** Unique per local day ("meal:lunch"). */
  key: string;
  title: string;
  body: string;
  /** In-app route the tap opens. */
  url: string;
}

interface Moment {
  key: (hour: number) => string;
  /** Local hours [from, to) when this nudge may go out. */
  hours: [number, number];
  title: string;
}

/** Which briefing insights are worth a push, and in which hours. Missing = never pushed. */
const MOMENTS: Partial<Record<BriefingKind, Moment>> = {
  sleep: { key: () => 'sleep', hours: [7, 10], title: 'How did you sleep?' },
  meal_time: {
    // Late in each meal window: they've likely eaten but not logged.
    key: (h) => `meal:${h < 12 ? 'breakfast' : h < 17 ? 'lunch' : 'dinner'}`,
    hours: [9, 22],
    title: 'Snap your plate',
  },
  water_behind: { key: () => 'water', hours: [11, 18], title: 'A glass of water?' },
  // From their own report: once a day, at a meal hour.
  priority: { key: () => 'priority', hours: [12, 21], title: 'For what you asked about' },
  protein_short: { key: () => 'protein', hours: [15, 20], title: 'Stay full till dinner' },
  open_challenges: { key: () => 'challenges', hours: [17, 20], title: 'Still time today' },
  streak_risk: { key: () => 'streak', hours: [19, 22], title: 'Keep your streak alive' },
};

/** Meal nudges only in the second half of each meal window (see briefing MEALS). */
const MEAL_NUDGE_HOURS = new Set([9, 10, 14, 15, 20, 21]);

export function quietHours(hour: number) {
  return hour >= QUIET_FROM || hour < QUIET_TO;
}

export function urlFor(action: BriefingAction | undefined): string {
  if (!action) return '/dashboard';
  switch (action.kind) {
    case 'log_meal':
      return '/dashboard?open=meal';
    case 'log_challenge':
      return `/dashboard?open=challenge&id=${encodeURIComponent(action.challengeId)}`;
    case 'ask':
      return `/assistant?prompt=${encodeURIComponent(action.prompt)}`;
  }
}

export function pickNudge(i: NudgeInput): Nudge | null {
  if (quietHours(i.hour)) return null;
  if (i.sentToday.length >= MAX_PER_DAY) return null;
  if (i.minutesSinceActive !== null && i.minutesSinceActive < ACTIVE_GRACE_MIN) return null;

  const moment = MOMENTS[i.briefing.kind];
  if (!moment) return null;
  const [from, to] = moment.hours;
  if (i.hour < from || i.hour >= to) return null;
  if (i.briefing.kind === 'meal_time' && !MEAL_NUDGE_HOURS.has(i.hour)) return null;

  const key = moment.key(i.hour);
  if (i.sentToday.includes(key)) return null;

  return {
    key,
    title: moment.title,
    body: i.briefing.headline,
    url: urlFor(i.briefing.actions[0]),
  };
}

/** Water reminders: opt-in, every 90 minutes in the day, only while behind pace. */
export const WATER_FROM = 9;
export const WATER_TO = 21;
export const WATER_EVERY_MIN = 90;

export interface WaterInput {
  hour: number;
  minute: number;
  sentToday: string[];
  minutesSinceActive: number | null;
  /** The user said yes to water reminders. */
  consent: boolean;
  /** Today's water challenge, if one is running (litres). */
  water: { challengeId: string; value: number; goal: number; step: number } | null;
}

/** How it helps first (the reviewer's point), the numbers second. Rotates by slot. */
const WATER_LINES = [
  'A glass now keeps the afternoon slump away.',
  'Half of “hungry” is thirsty. Sip first.',
  'Fewer headaches later: a glass now.',
  'Water helps your focus more than coffee does.',
  'A glass now, and dinner cravings ease off.',
];

const fmtL = (n: number) => String(Math.round(n * 100) / 100);

export function pickWaterNudge(i: WaterInput): Nudge | null {
  if (!i.consent || !i.water) return null;
  if (i.hour < WATER_FROM || i.hour >= WATER_TO || quietHours(i.hour)) return null;
  if (i.sentToday.length >= MAX_PER_DAY) return null;
  if (i.minutesSinceActive !== null && i.minutesSinceActive < ACTIVE_GRACE_MIN) return null;

  const { value, goal, step, challengeId } = i.water;
  if (value >= goal) return null;
  // Where they "should" be by now, spread evenly over the water day.
  const dayMin = (WATER_TO - WATER_FROM) * 60;
  const elapsed = i.hour * 60 + i.minute - WATER_FROM * 60;
  const expected = (goal * elapsed) / dayMin;
  if (value + step > expected) return null; // on pace: no need to interrupt

  const slot = Math.floor(elapsed / WATER_EVERY_MIN);
  const key = `water:${slot}`;
  if (i.sentToday.includes(key)) return null;
  return {
    key,
    title: 'Time for a glass',
    body: `${WATER_LINES[slot % WATER_LINES.length]} ${fmtL(value)} of ${fmtL(goal)} L so far.`,
    url: `/dashboard?open=challenge&id=${encodeURIComponent(challengeId)}`,
  };
}

/** The worker scans every 10 minutes, so a reminder is due in the 10 minutes after its time. */
export const REMINDER_WINDOW_MIN = 10;

export interface ReminderInput {
  hour: number;
  minute: number;
  sentToday: string[];
  reminders: {
    challengeId: string;
    title: string;
    /** The challenge's "how it'll feel" line. */
    why: string;
    remindAt: string; // "HH:MM", the user's clock
    done: boolean;
  }[];
}

/**
 * Reminders the user set themselves (a morning walk, a tablet, "no snacking after 9").
 * They chose the time, so quiet hours and the "already in the app" rule don't apply; done
 * challenges and ones already reminded today are skipped. Earliest due first.
 */
export function pickReminder(i: ReminderInput): Nudge | null {
  if (i.sentToday.length >= MAX_PER_DAY) return null;
  const now = i.hour * 60 + i.minute;
  const due = i.reminders
    .map((r) => {
      const [h, m] = r.remindAt.split(':').map(Number);
      return { ...r, at: h! * 60 + m! };
    })
    .filter((r) => !r.done && now >= r.at && now < r.at + REMINDER_WINDOW_MIN)
    // Keyed by the time too: moving a reminder to later today gets a fresh send.
    .filter((r) => !i.sentToday.includes(`remind:${r.challengeId}:${r.remindAt}`))
    .sort((a, b) => a.at - b.at)[0];
  if (!due) return null;
  return {
    key: `remind:${due.challengeId}:${due.remindAt}`,
    title: due.title,
    body: due.why ? `${due.why.charAt(0).toUpperCase()}${due.why.slice(1)}.` : 'Your reminder.',
    url: `/dashboard?open=challenge&id=${encodeURIComponent(due.challengeId)}`,
  };
}

/** Sunday evening, once: the weekly check-in ("is my health improving?"). */
export function pickWeekly(i: { date: string; hour: number; sentToday: string[] }): Nudge | null {
  const sunday = new Date(`${i.date}T12:00:00Z`).getUTCDay() === 0;
  if (!sunday || i.hour < 18 || i.hour >= 20) return null;
  if (i.sentToday.includes('week') || i.sentToday.length >= MAX_PER_DAY) return null;
  return {
    key: 'week',
    title: 'Your week, in one look',
    body: 'See what got better. 30 seconds.',
    url: '/week',
  };
}
