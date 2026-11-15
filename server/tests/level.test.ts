import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ChallengeTracking } from '../src/db/schema';
import { buildBriefing, type BriefingInput } from '../src/services/briefing/briefing.rules';
import {
  changedRecently,
  goalOn,
  levelUpFor,
  nextTarget,
  withTarget,
} from '../src/services/challenges/level';
import { buildWeek, type WeekTotals } from '../src/services/week/week.rules';

const walk: ChallengeTracking = {
  kind: 'amount',
  unit: 'min',
  target: 20,
  step: 5,
  widget: 'bars',
  proof: '',
  label: 'Walk',
};
const TODAY = '2026-11-15';

describe('goals that follow progress', () => {
  it('steps by the challenge’s own step, within a cap', () => {
    assert.equal(nextTarget(walk, 'movement', 'up'), 25);
    assert.equal(nextTarget(walk, 'movement', 'down'), 15);
    assert.equal(nextTarget({ ...walk, target: 90 }, 'movement', 'up'), null);
    assert.equal(nextTarget({ ...walk, target: 5 }, 'movement', 'down'), null);
  });

  it('never moves water, sleep or done/not-done habits', () => {
    assert.equal(nextTarget({ ...walk, unit: 'L' }, 'hydration', 'up'), null);
    assert.equal(nextTarget({ ...walk, unit: 'h' }, 'sleep', 'up'), null);
    assert.equal(nextTarget({ ...walk, kind: 'check' }, 'mindset', 'up'), null);
  });

  it('a change starts tomorrow: today and earlier keep their goal', () => {
    const t = withTarget(walk, 25, TODAY);
    assert.equal(goalOn(t, '2026-11-10'), 20);
    assert.equal(goalOn(t, TODAY), 20);
    assert.equal(goalOn(t, '2026-11-16'), 25);
    // A second change the same day replaces the first instead of stacking.
    const again = withTarget(t, 15, TODAY);
    assert.equal(again.levels!.length, 1);
    assert.equal(goalOn(again, '2026-11-16'), 15);
  });

  it('offers a step up after a week in a row, then waits a week', () => {
    const c = { frequency: 'daily', category: 'movement', tracking: walk };
    assert.equal(levelUpFor(c, 6, TODAY), null);
    assert.equal(levelUpFor(c, 7, TODAY), 25);
    const changed = { ...c, tracking: withTarget(walk, 25, '2026-11-12') };
    assert.equal(changedRecently(changed.tracking, TODAY), true);
    assert.equal(levelUpFor(changed, 14, TODAY), null);
  });
});

describe('the PA offers it', () => {
  it('on the day a habit hits its week, the card is the step up', () => {
    const input: BriefingInput = {
      name: 'Asha',
      hour: 18,
      diet: 'veg',
      allergies: [],
      why: 'Keep up',
      targets: { calories: 1800, proteinG: 70 },
      eaten: { calories: 1500, proteinG: 65 },
      mealHours: [8, 13],
      sleepMinutes: 420,
      findings: [],
      foods: [],
      suggestions: [],
      challenges: [
        {
          id: 'w',
          label: 'Walk',
          category: 'movement',
          frequency: 'daily',
          unit: 'min',
          step: 5,
          value: 20,
          goal: 20,
          done: true,
          streak: 7,
          history: [],
          levelUp: 25,
        },
      ],
    };
    const b = buildBriefing(input);
    assert.equal(b.kind, 'level_up');
    assert.deepEqual(b.actions[0], { kind: 'level_up', label: 'Make it 25 min', challengeId: 'w' });
  });

  it('the week check-in: step up the perfect habit, ease the slipping one', () => {
    const totals: WeekTotals = {
      activeDays: 7,
      fullDays: 3,
      loggedDays: 7,
      avgKcal: 1800,
      avgProteinG: 60,
      activeMinutes: 140,
      sleepNights: 7,
      avgSleepH: 7,
    };
    const w = buildWeek({
      name: 'Asha',
      targets: { calories: 1800, proteinG: 70 },
      thisWeek: totals,
      lastWeek: totals,
      habits: [
        { id: 'w', label: 'Walk', unit: 'min', done: 7, active: 7, goal: 20, up: 25, down: 15 },
        { id: 'p', label: 'Plank', unit: 'min', done: 2, active: 7, goal: 3, up: 4, down: 2 },
      ],
    });
    assert.deepEqual(w.levelUp, { challengeId: 'w', label: 'Walk', from: 20, to: 25, unit: 'min' });
    assert.deepEqual(w.focus?.ease, {
      challengeId: 'p',
      label: 'Plank',
      from: 3,
      to: 2,
      unit: 'min',
    });
  });
});
