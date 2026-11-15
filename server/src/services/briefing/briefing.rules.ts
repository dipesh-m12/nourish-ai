import type { ReportFinding } from '../../db/schema';
import { containsAllergen } from '../diet-rules';
import { priorityTip } from '../priorities/priorities.rules';

/**
 * The daily briefing's brain: given the user's day so far, pick the ONE thing that matters most
 * right now, and say it with real numbers. Pure (no I/O), so every branch is easy to test.
 */

export type BriefingKind =
  | 'all_done'
  | 'sleep'
  | 'meal_time'
  | 'over'
  | 'near_limit'
  | 'priority'
  | 'protein_short'
  | 'water_behind'
  | 'streak_risk'
  | 'open_challenges'
  | 'suggest'
  | 'level_up'
  | 'checkin'
  | 'on_track';

export type BriefingAction =
  | { kind: 'log_meal'; label: string }
  | { kind: 'log_challenge'; label: string; challengeId: string }
  | { kind: 'ask'; label: string; prompt: string }
  /** Start one of the plan's ideas (it isn't running yet). */
  | { kind: 'add_challenge'; label: string; challengeId: string }
  /** Raise a challenge's goal one step, from today. */
  | { kind: 'level_up'; label: string; challengeId: string }
  /** Open the "+" sheet as a check-in: the AI knows it's a progress update (weight…). */
  | { kind: 'checkin'; label: string };

export interface BriefingChallenge {
  id: string;
  label: string;
  category: string;
  frequency: 'daily' | 'weekly';
  unit: string | null;
  step: number;
  value: number;
  goal: number;
  done: boolean;
  streak: number;
  /** Last days, oldest first; `active` = the challenge existed that day, `goal` = that day's. */
  history: { date: string; value: number; active: boolean; goal?: number }[];
  /** The next goal the PA may offer after a week hit in a row (null = not now). */
  levelUp?: number | null;
}

export interface BriefingInput {
  name: string;
  hour: number;
  diet: string | null;
  allergies: string[];
  why: string;
  targets: { calories: number; proteinG: number };
  eaten: { calories: number; proteinG: number };
  /** Local hour each meal was logged (user's clock). */
  mealHours: number[];
  sleepMinutes: number;
  challenges: BriefingChallenge[];
  /** Abnormal markers from their reports (latest per area). */
  findings: ReportFinding[];
  /** Everything eaten today, by name. */
  foods: string[];
  /** The plan's ideas the user hasn't started, best first. */
  suggestions: Suggestion[];
  /** A weight goal and a week since the last weigh-in (or since they started): ask for it. */
  weighInDue: boolean;
}

/** A plan idea the PA offers; the card shows it as a row that opens to its why and "Add it". */
export interface Suggestion {
  id: string;
  title: string;
  category: string;
  target: string;
  /** How it'll feel (or why it helps), one short line. */
  why: string;
}

export interface Briefing {
  kind: BriefingKind;
  greeting: string;
  /** The insight, one or two short sentences, numbers included. */
  headline: string;
  actions: BriefingAction[];
  /** Ties the advice to the user's own reason. */
  why: string;
  /** A habit seen over the last week ("Salad: 2 of 7 days"). */
  week: string | null;
  /** Every number the text may contain (the AI rewrite is checked against these). */
  facts: Record<string, number | string>;
  /** Set when the card offers a new challenge (its details live here, not in the headline). */
  suggestion: Suggestion | null;
}

const MEALS = [
  { name: 'breakfast', from: 7, to: 11 },
  { name: 'lunch', from: 12, to: 16 },
  { name: 'dinner', from: 19, to: 23 },
] as const;

/** Waking day the "by now" pacing runs over (7 am → 10 pm). */
const DAY_START = 7;
const DAY_END = 22;
const PROTEIN_SLACK_G = 15;
const NEAR_LIMIT_KCAL = 300;
/** Evening room that means "you haven't really eaten yet", not "you're doing great". */
const BIG_GAP_KCAL = 600;

/** Protein-rich foods that fit the diet, minus anything the user is allergic to. */
const PROTEIN_FOODS: Record<string, string[]> = {
  veg: ['dal', 'paneer', 'curd', 'chana', 'rajma'],
  eggetarian: ['eggs', 'paneer', 'dal', 'curd', 'chana'],
  vegan: ['tofu', 'chana', 'soy chunks', 'rajma', 'peanuts'],
  jain: ['paneer', 'curd', 'moong dal', 'chana'],
  non_veg: ['eggs', 'chicken', 'fish', 'dal', 'paneer'],
};

export function proteinIdeas(diet: string | null, allergies: string[]) {
  const foods = PROTEIN_FOODS[diet ?? 'veg'] ?? PROTEIN_FOODS.veg!;
  return foods.filter((f) => !containsAllergen(f, allergies)).slice(0, 2);
}

const greet = (hour: number, name: string) => {
  const first = name.split(' ')[0];
  if (hour < 12) return `Good morning, ${first}`;
  if (hour < 17) return `Good afternoon, ${first}`;
  return `Good evening, ${first}`;
};

/** 0 → 1 across the waking day: how much of a daily target "should" be done by now. */
/** Past this many daily habits, the PA stops offering new ones (more isn't better). */
const MAX_TO_SUGGEST = 3;
/** Night: from 23:00 to 05:00 the card only says rest. */
const NIGHT_FROM = 23;
const NIGHT_TO = 5;

export function dayFraction(hour: number) {
  return Math.min(1, Math.max(0, (hour - DAY_START) / (DAY_END - DAY_START)));
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmt = (n: number) => String(Math.round(n * 100) / 100);
const clock12 = (h: number) => `${((h + 11) % 12) + 1} ${h < 12 ? 'am' : 'pm'}`;

/** The daily challenge done least often over the last 7 finished days (if it's under 60%). */
export function weakSpot(challenges: BriefingChallenge[]): string | null {
  let worst: { label: string; done: number; days: number } | null = null;
  for (const c of challenges.filter((x) => x.frequency === 'daily')) {
    const past = c.history
      .slice(0, -1)
      .slice(-7)
      .filter((d) => d.active);
    if (past.length < 3) continue; // too new to call it a habit
    const done = past.filter((d) => d.value >= (d.goal ?? c.goal)).length;
    if (done / past.length >= 0.6) continue;
    if (!worst || done / past.length < worst.done / worst.days) {
      worst = { label: c.label, done, days: past.length };
    }
  }
  return worst
    ? `${worst.label}: ${worst.done} of ${worst.days} days this week. Your weak spot.`
    : null;
}

export function buildBriefing(i: BriefingInput): Briefing {
  const greeting = greet(i.hour, i.name);
  const left = i.targets.calories - i.eaten.calories;
  const frac = dayFraction(i.hour);
  const daily = i.challenges.filter((c) => c.frequency === 'daily');
  const open = daily.filter((c) => !c.done);
  const week = weakSpot(i.challenges);
  const base = { greeting, week, suggestion: null as Suggestion | null };
  // Fallback wording; the AI rewrite blends the lead and their own words into one line.
  const why = (lead: string) => `${lead} You said: “${i.why}”.`;

  // A plan idea from an area they don't cover yet: what the PA offers when there's room for it.
  const idea = i.suggestions.find((s) => !i.challenges.some((c) => c.category === s.category));

  // A habit just hit a full week in a row (and every 7 days after): offer the next step.
  // `streak` counts today only once it's done, so "% 7 === 0" catches both the evening the
  // week completes and the next morning (the start of week two).
  const ready = daily.find((c) => c.levelUp && c.streak >= 7 && c.streak % 7 === 0);
  const levelUp = ready
    ? {
        ...base,
        kind: 'level_up' as const,
        headline:
          `${ready.streak} days of ${ready.label} in a row. Ready for ${fmt(ready.levelUp!)} ${ready.unit ?? ''}?`.replace(
            ' ?',
            '?',
          ),
        actions: [
          {
            kind: 'level_up' as const,
            label: `Make it ${fmt(ready.levelUp!)} ${ready.unit ?? ''}`.trim(),
            challengeId: ready.id,
          },
        ],
        why: why('Small steps up are how it keeps working.'),
        facts: { streak: ready.streak, next: ready.levelUp! },
      }
    : null;

  // 1. Everything done and calories in range: celebrate. In the evening with lots of room left,
  //    the celebration also makes sure they actually eat (undereating isn't the goal). With few
  //    habits running, it offers one more from an area they don't cover yet.
  if (daily.length > 0 && open.length === 0 && left >= 0) {
    const bigGap = i.hour >= 17 && left > BIG_GAP_KCAL;
    // A week-long streak today: the step up is the celebration.
    if (levelUp && !bigGap) return levelUp;
    const oneMore = !bigGap && idea && daily.length < MAX_TO_SUGGEST ? idea : null;
    return {
      ...base,
      kind: 'all_done',
      headline: bigGap
        ? `Every challenge done today. You still have ${left} kcal: make dinner a proper one, with ${proteinIdeas(i.diet, i.allergies)[0] ?? 'protein'}.`
        : oneMore
          ? 'Every challenge done today.'
          : `Every challenge done today, and ${left} kcal still in hand. That's a full day.`,
      actions: bigGap ? [{ kind: 'log_meal', label: 'Log dinner' }] : [],
      suggestion: oneMore,
      why: why('This is what it looks like.'),
      facts: { left },
    };
  }

  // 1½. Late night: no "walk now?" at 2 am. A PA tells you to rest.
  if (i.hour >= NIGHT_FROM || i.hour < NIGHT_TO) {
    return {
      ...base,
      kind: 'on_track',
      headline: 'It’s late. Rest well, tomorrow is a fresh start.',
      actions: [],
      why: why('Sleep is when the day’s work pays off.'),
      facts: { left },
    };
  }

  // 2. Morning, last night's sleep not logged, and they have a sleep challenge to log it on.
  //    No sleep challenge = nothing to log: the PA doesn't ask for data it won't use.
  const sleep = daily.find((c) => c.category === 'sleep' && !c.done);
  if (sleep && i.hour >= 5 && i.hour < 12 && i.sleepMinutes === 0) {
    return {
      ...base,
      kind: 'sleep',
      headline: 'How did you sleep? Log last night in one tap.',
      actions: [{ kind: 'log_challenge', label: `Log ${sleep.label}`, challengeId: sleep.id }],
      why: why('Good sleep makes the rest of the day easier.'),
      facts: {},
    };
  }

  // 2½. Weekly weigh-in for a weight goal: the outcome itself, said in the "+" sheet.
  if (i.weighInDue && i.hour >= 7) {
    return {
      ...base,
      kind: 'checkin',
      headline: 'A week in. What do you weigh now?',
      actions: [{ kind: 'checkin', label: 'Log it' }],
      why: why('Seeing it move is what keeps you going.'),
      facts: {},
    };
  }

  // 3. A meal window is open and nothing's been logged in it.
  const meal = MEALS.find((m) => i.hour >= m.from && i.hour < m.to);
  if (meal && !i.mealHours.some((h) => h >= meal.from)) {
    return {
      ...base,
      kind: 'meal_time',
      headline: `${meal.name[0]!.toUpperCase()}${meal.name.slice(1)} time. Snap it or tell me what you had.`,
      actions: [
        { kind: 'log_meal', label: 'Snap my plate' },
        { kind: 'ask', label: 'Tell Nourish', prompt: `Log my ${meal.name}` },
      ],
      why: why('Logging as you go keeps the day honest.'),
      facts: { left },
    };
  }

  // 4. Over the day's calories.
  if (left < 0) {
    return {
      ...base,
      kind: 'over',
      headline: `${-left} kcal over today. Keep the rest light, no stress: one day doesn’t undo a week.`,
      actions: [
        {
          kind: 'ask',
          label: 'Light dinner idea',
          prompt: 'Suggest a light dinner for the rest of today',
        },
      ],
      why: why('Steady beats perfect.'),
      facts: { over: -left },
    };
  }

  // 5. Evening with little room left.
  if (i.hour >= 17 && left < NEAR_LIMIT_KCAL) {
    return {
      ...base,
      kind: 'near_limit',
      headline: `${left} kcal left for today. A light dinner like dal and sabzi, skip the second roti.`,
      actions: [{ kind: 'log_meal', label: 'Log dinner' }],
      why: why('Finishing on target is the win.'),
      facts: { left },
    };
  }

  // 5½. Their own priority (from a report they shared): the food or habit that helps, now,
  //     unless today's log already covers it. Said as a feeling, not a lab number.
  const tip = priorityTip({
    hour: i.hour,
    diet: i.diet,
    allergies: i.allergies,
    findings: i.findings,
    foods: i.foods,
  });
  // A habit tip goes through their own challenge for it when they have one: done today = the
  // tip is covered (stay quiet); open = log it; none = offer to add it.
  const habit = tip?.habit ? daily.find((c) => tip.habit!.test(c.label)) : undefined;
  if (tip && !habit?.done) {
    return {
      ...base,
      kind: 'priority',
      headline: tip.headline,
      actions:
        tip.action === 'log_meal'
          ? [{ kind: 'log_meal', label: 'Log a meal' }]
          : habit
            ? [{ kind: 'log_challenge', label: `Log ${habit.label}`, challengeId: habit.id }]
            : [{ kind: 'ask', label: 'Add it', prompt: tip.prompt! }],
      why: why(`${cap(tip.feel)}.`),
      facts: { area: tip.area },
    };
  }

  // 6. Protein behind where it should be by now.
  const proteinByNow = Math.round(i.targets.proteinG * frac);
  const proteinShort = proteinByNow - i.eaten.proteinG;
  if (i.hour >= 13 && proteinShort >= PROTEIN_SLACK_G) {
    const ideas = proteinIdeas(i.diet, i.allergies);
    const short = Math.round(i.targets.proteinG - i.eaten.proteinG);
    return {
      ...base,
      kind: 'protein_short',
      headline:
        i.eaten.proteinG === 0
          ? `No protein logged yet (today’s goal is ${i.targets.proteinG} g). Add ${ideas.join(' or ')} to your next meal.`
          : `Protein is ${short} g short of today’s ${i.targets.proteinG} g. Add ${ideas.join(' or ')} to your next meal.`,
      actions: [{ kind: 'log_meal', label: 'Log a meal' }],
      why: why('Protein keeps you full and strong.'),
      facts: { short, target: i.targets.proteinG },
    };
  }

  // 7. Water behind for the hour.
  const water = daily.find((c) => c.category === 'hydration' && !c.done);
  if (water && i.hour >= 10) {
    const expected = water.goal * frac;
    if (water.value + water.step <= expected) {
      const unit = water.unit ?? '';
      return {
        ...base,
        kind: 'water_behind',
        headline: `${fmt(water.value)} of ${fmt(water.goal)} ${unit} water so far, a bit behind for ${clock12(i.hour)}. A glass now?`,
        actions: [
          {
            kind: 'log_challenge',
            label: `+${fmt(water.step)} ${unit}`.trim(),
            challengeId: water.id,
          },
        ],
        why: why('Small sips all day beat a bottle at night.'),
        facts: { value: water.value, goal: water.goal, step: water.step },
      };
    }
  }

  // 7½. A habit hit its week today: the next step, before nudging the rest.
  if (levelUp) return levelUp;

  // 8. Evening, a streak still open today.
  const atRisk = open.filter((c) => c.streak >= 2).sort((a, b) => b.streak - a.streak)[0];
  if (i.hour >= 17 && atRisk) {
    return {
      ...base,
      kind: 'streak_risk',
      headline: `${atRisk.label} is on a ${atRisk.streak}-day streak. Do it today to keep it alive.`,
      actions: [{ kind: 'log_challenge', label: `Log ${atRisk.label}`, challengeId: atRisk.id }],
      why: why('Streaks are how habits stick.'),
      facts: { streak: atRisk.streak },
    };
  }

  // 9. Challenges still open.
  if (open.length > 0) {
    const names = open.slice(0, 2).map((c) => c.label);
    return {
      ...base,
      kind: 'open_challenges',
      headline: `${open.length} left today: ${names.join(', ')}${open.length > 2 ? '…' : ''}. One now?`,
      actions: [
        { kind: 'log_challenge', label: `Log ${open[0]!.label}`, challengeId: open[0]!.id },
      ],
      why: why('Each one is a step toward why you started.'),
      facts: { open: open.length },
    };
  }

  // 10. No daily habit to work on: propose one plan idea from an area they don't cover yet.
  if (idea && i.hour >= 8) {
    return {
      ...base,
      kind: 'suggest',
      headline: 'All good for now.',
      actions: [],
      why: why('One small habit at a time adds up.'),
      facts: { left },
      suggestion: idea,
    };
  }

  // 11. On track.
  return {
    ...base,
    kind: 'on_track',
    // Only claim protein when there's some and it's on pace (not at 8 am with none eaten).
    headline:
      i.eaten.proteinG > 0 && proteinShort < PROTEIN_SLACK_G
        ? `On track: ${left} kcal left and protein on pace. Keep the rhythm.`
        : `On track: ${left} kcal left. Keep the rhythm.`,
    actions: [],
    why: why('Remember why.'),
    facts: { left },
  };
}
