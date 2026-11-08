import { containsAllergen } from '../diet-rules';

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
  | 'protein_short'
  | 'water_behind'
  | 'streak_risk'
  | 'open_challenges'
  | 'on_track';

export type BriefingAction =
  | { kind: 'log_meal'; label: string }
  | { kind: 'log_challenge'; label: string; challengeId: string }
  | { kind: 'ask'; label: string; prompt: string };

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
  /** Last days, oldest first; `active` = the challenge existed that day. */
  history: { date: string; value: number; active: boolean }[];
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
    const done = past.filter((d) => d.value >= c.goal).length;
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
  const base = { greeting, week };
  // Fallback wording; the AI rewrite blends the lead and their own words into one line.
  const why = (lead: string) => `${lead} You said: “${i.why}”.`;

  // 1. Everything done and calories in range: celebrate. In the evening with lots of room left,
  //    the celebration also makes sure they actually eat (undereating isn't the goal).
  if (daily.length > 0 && open.length === 0 && left >= 0) {
    const bigGap = i.hour >= 17 && left > BIG_GAP_KCAL;
    return {
      ...base,
      kind: 'all_done',
      headline: bigGap
        ? `Every challenge done today. You still have ${left} kcal: make dinner a proper one, with ${proteinIdeas(i.diet, i.allergies)[0] ?? 'protein'}.`
        : `Every challenge done today, and ${left} kcal still in hand. That's a full day.`,
      actions: bigGap ? [{ kind: 'log_meal', label: 'Log dinner' }] : [],
      why: why('This is what it looks like.'),
      facts: { left },
    };
  }

  // 2. Morning, last night's sleep not logged.
  if (i.hour >= 5 && i.hour < 12 && i.sleepMinutes === 0) {
    return {
      ...base,
      kind: 'sleep',
      headline: 'How did you sleep? Tell me and I’ll log it.',
      actions: [{ kind: 'ask', label: 'Log my sleep', prompt: 'Log my sleep from last night' }],
      why: why('Good sleep makes the rest of the day easier.'),
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

  // 10. On track.
  return {
    ...base,
    kind: 'on_track',
    headline: `On track: ${left} kcal left and protein covered. Keep the rhythm.`,
    actions: [],
    why: why('Remember why.'),
    facts: { left },
  };
}
