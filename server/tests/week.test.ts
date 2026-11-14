import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildWeek, type WeekInput, type WeekTotals } from '../src/services/week/week.rules';

const empty: WeekTotals = {
  activeDays: 0,
  fullDays: 0,
  loggedDays: 0,
  avgKcal: 0,
  avgProteinG: 0,
  activeMinutes: 0,
  sleepNights: 0,
  avgSleepH: 0,
};
const input = (over: Partial<WeekInput> = {}): WeekInput => ({
  name: 'Asha',
  targets: { calories: 1800, proteinG: 90 },
  thisWeek: {
    ...empty,
    activeDays: 7,
    fullDays: 5,
    loggedDays: 6,
    avgKcal: 1850,
    avgProteinG: 80,
    activeMinutes: 140,
  },
  lastWeek: {
    ...empty,
    activeDays: 7,
    fullDays: 3,
    loggedDays: 5,
    avgKcal: 2200,
    avgProteinG: 60,
    activeMinutes: 90,
  },
  habits: [
    { label: 'Water', done: 7, active: 7 },
    { label: 'Walk', done: 2, active: 7 },
  ],
  ...over,
});

describe('buildWeek', () => {
  it('reports improvement against last week, at most three stats', () => {
    const w = buildWeek(input());
    assert.equal(w.trend, 'up');
    assert.equal(w.stats.length, 3);
    assert.deepEqual(
      w.stats.map((s) => [s.key, s.now, s.before, s.better]),
      [
        ['days', '5 of 7', '3 of 7', true],
        ['protein', '80 g', '60 g', true],
        ['move', '140 min', '90 min', true],
      ],
    );
  });

  it('names the best habit and offers help with the weakest', () => {
    const w = buildWeek(input());
    assert.equal(w.best, 'Water');
    assert.equal(w.focus?.label, 'Walk');
    assert.match(w.focus!.prompt, /2 of 7 days/);
  });

  it('first week has nothing to compare and says so kindly', () => {
    const w = buildWeek(input({ lastWeek: empty }));
    assert.equal(w.trend, 'first');
    assert.match(w.headline, /Week one, Asha/);
    assert.ok(w.stats.every((s) => s.better === null));
  });

  it('a worse week is framed gently, never as failure', () => {
    const w = buildWeek(
      input({
        thisWeek: {
          ...empty,
          activeDays: 7,
          fullDays: 1,
          loggedDays: 2,
          avgKcal: 2500,
          avgProteinG: 40,
          activeMinutes: 20,
        },
      }),
    );
    assert.equal(w.trend, 'down');
    assert.doesNotMatch(w.headline, /fail|bad|over/i);
  });
});
