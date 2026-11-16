import { buildBriefing, type BriefingInput, type BriefingKind } from './briefing.rules';

/**
 * Demo mode for recording: an admin switches it on for one profile, and every dashboard load
 * then shows the next card the PA can show, built by the real rules from that account's own
 * challenges with the day's clock and numbers set so the card applies. It only changes the
 * card (never stored data or push nudges), and it switches itself off after a day.
 */

interface Scenario {
  id: string;
  kind: BriefingKind;
  build: (i: BriefingInput) => BriefingInput;
}

/** A plain mid-afternoon: two meals in, numbers on pace, every habit open, nothing due. */
function calm(r: BriefingInput): BriefingInput {
  return {
    ...r,
    hour: 15,
    mealHours: [8, 13],
    eaten: {
      calories: Math.round(r.targets.calories * 0.55),
      proteinG: Math.round(r.targets.proteinG * 0.6),
    },
    sleepMinutes: 420,
    findings: [],
    foods: ['idli', 'curd rice'],
    weighInDue: false,
    remindersDue: false,
    challenges: r.challenges.map((c) => ({
      ...c,
      done: false,
      // Water ahead of the clock, so "a glass now?" only shows when it's the point.
      value: c.category === 'hydration' ? Math.round(c.goal * 0.9 * 100) / 100 : 0,
      streak: 0,
      levelUp: null,
      history: c.history.map((h) => ({ ...h, value: h.goal ?? c.goal })),
    })),
  };
}

const daily = (i: BriefingInput) => i.challenges.filter((c) => c.frequency === 'daily');
const withOne = (
  i: BriefingInput,
  pick: (c: BriefingInput['challenges'][number]) => boolean,
  patch: Partial<BriefingInput['challenges'][number]>,
) => {
  const target = daily(i).find(pick);
  return {
    ...i,
    challenges: i.challenges.map((c) => (c === target ? { ...c, ...patch } : c)),
  };
};

const LOW_IRON = {
  marker: 'Haemoglobin',
  value: '10.9',
  unit: 'g/dL',
  flag: 'low' as const,
  area: 'iron' as const,
};

/** In the order a day runs, so the recording tells a story. */
const SCENARIOS: Scenario[] = [
  {
    id: 'sleep',
    kind: 'sleep',
    build: (r) => ({ ...calm(r), hour: 8, mealHours: [], sleepMinutes: 0 }),
  },
  {
    id: 'reminders',
    kind: 'reminders',
    build: (r) => ({ ...calm(r), hour: 9, remindersDue: true }),
  },
  { id: 'checkin', kind: 'checkin', build: (r) => ({ ...calm(r), weighInDue: true }) },
  {
    id: 'meal_time',
    kind: 'meal_time',
    build: (r) => ({ ...calm(r), hour: 13, mealHours: [8] }),
  },
  {
    id: 'priority',
    kind: 'priority',
    build: (r) => {
      const real = r.findings.filter((f) => f.flag !== 'normal');
      return { ...calm(r), hour: 14, foods: ['idli'], findings: real.length ? real : [LOW_IRON] };
    },
  },
  {
    id: 'protein_short',
    kind: 'protein_short',
    build: (r) => ({ ...calm(r), hour: 16, eaten: { ...calm(r).eaten, proteinG: 12 } }),
  },
  {
    id: 'water_behind',
    kind: 'water_behind',
    build: (r) => withOne(calm(r), (c) => c.category === 'hydration', { value: 0 }),
  },
  { id: 'open_challenges', kind: 'open_challenges', build: (r) => calm(r) },
  { id: 'level_up', kind: 'level_up', build: (r) => levelUpInput(r) },
  {
    id: 'streak_risk',
    kind: 'streak_risk',
    build: (r) =>
      withOne(
        {
          ...calm(r),
          hour: 18,
          eaten: {
            calories: Math.round(r.targets.calories * 0.7),
            proteinG: Math.round(r.targets.proteinG * 0.85),
          },
        },
        (c) => c.category !== 'hydration',
        { streak: 4 },
      ),
  },
  {
    id: 'near_limit',
    kind: 'near_limit',
    build: (r) => ({
      ...calm(r),
      hour: 19,
      mealHours: [8, 13, 19],
      eaten: {
        calories: r.targets.calories - 180,
        proteinG: Math.round(r.targets.proteinG * 0.9),
      },
    }),
  },
  {
    id: 'over',
    kind: 'over',
    build: (r) => ({
      ...calm(r),
      hour: 20,
      mealHours: [8, 13, 20],
      eaten: { calories: r.targets.calories + 240, proteinG: r.targets.proteinG },
    }),
  },
  {
    id: 'all_done',
    kind: 'all_done',
    build: (r) => {
      const c = calm(r);
      return { ...c, challenges: c.challenges.map((x) => ({ ...x, done: true })) };
    },
  },
  {
    id: 'suggest',
    kind: 'suggest',
    build: (r) => ({ ...calm(r), challenges: [] }),
  },
  {
    id: 'on_track',
    kind: 'on_track',
    build: (r) => ({ ...calm(r), challenges: [], suggestions: [] }),
  },
  {
    id: 'night',
    kind: 'on_track',
    build: (r) => ({ ...calm(r), hour: 23 }),
  },
];

/** level_up needs the picked habit's own next step: a week done in a row, one step more. */
function levelUpInput(r: BriefingInput): BriefingInput {
  const c = calm(r);
  const pick = daily(c).find((x) => x.category !== 'hydration' && x.goal > 1) ?? daily(c)[0];
  if (!pick) return c;
  const next = Math.round(pick.goal + Math.max(pick.step, pick.goal * 0.25));
  return {
    ...c,
    challenges: c.challenges.map((x) =>
      x === pick ? { ...x, done: true, value: x.goal, streak: 7, levelUp: next } : x,
    ),
  };
}

/** The scenarios this account can show (e.g. water_behind needs a water habit). */
export function demoScenarios(real: BriefingInput) {
  return SCENARIOS.filter((s) => buildBriefing(s.build(real)).kind === s.kind);
}
