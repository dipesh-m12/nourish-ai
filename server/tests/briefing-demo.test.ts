import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { demoScenarios } from '../src/services/briefing/briefing.demo';
import {
  buildBriefing,
  type BriefingChallenge,
  type BriefingInput,
} from '../src/services/briefing/briefing.rules';

const ch = (over: Partial<BriefingChallenge>): BriefingChallenge => ({
  id: 'c1',
  label: 'Walk',
  category: 'movement',
  frequency: 'daily',
  unit: 'min',
  step: 5,
  value: 0,
  goal: 20,
  done: false,
  streak: 0,
  history: [],
  ...over,
});

const real: BriefingInput = {
  name: 'Asha',
  hour: 11,
  diet: 'veg',
  allergies: [],
  why: 'Keep up with my daughter',
  targets: { calories: 1700, proteinG: 75 },
  eaten: { calories: 0, proteinG: 0 },
  mealHours: [],
  sleepMinutes: 0,
  challenges: [
    ch({ id: 'walk' }),
    ch({ id: 'water', label: 'Water', category: 'hydration', unit: 'glasses', step: 1, goal: 8 }),
    ch({ id: 'sleep', label: 'Sleep', category: 'sleep', unit: 'h', step: 0.5, goal: 7 }),
  ],
  findings: [],
  foods: [],
  suggestions: [
    { id: 'p1', title: 'Breathe', category: 'mind', target: '5 min', why: 'calmer evenings' },
  ],
  weighInDue: false,
  remindersDue: false,
};

describe('demo mode shows every card the PA has', () => {
  it('an account with walk, water and sleep reaches every kind', () => {
    const kinds = new Set(demoScenarios(real).map((s) => buildBriefing(s.build(real)).kind));
    for (const k of [
      'sleep',
      'reminders',
      'checkin',
      'meal_time',
      'priority',
      'protein_short',
      'water_behind',
      'open_challenges',
      'level_up',
      'streak_risk',
      'near_limit',
      'over',
      'all_done',
      'suggest',
      'on_track',
    ])
      assert.ok(kinds.has(k as never), `missing ${k}`);
  });

  it('cards only point at the account’s own challenges', () => {
    const ids = new Set(real.challenges.map((c) => c.id));
    for (const s of demoScenarios(real))
      for (const a of buildBriefing(s.build(real)).actions)
        if ('challengeId' in a) assert.ok(ids.has(a.challengeId), `${s.id} → ${a.challengeId}`);
  });
});
