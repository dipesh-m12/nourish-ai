import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dailyStreak } from '../src/services/challenges/streak';
import { companionMood, type DailyHistory } from '../src/services/companion/companion.rules';
import { addDays } from '../src/utils/dates';

const TODAY = '2026-11-15';
/** Days done, as offsets from today (0 = today, 1 = yesterday…). */
const doneOn =
  (...back: number[]) =>
  (day: string) =>
    back.some((n) => addDays(TODAY, -n) === day);
const START = '2026-10-01';

describe('daily streak with a rest day', () => {
  it('counts an unbroken run, and today still open does not break it', () => {
    assert.equal(dailyStreak(doneOn(0, 1, 2), TODAY, START), 3);
    assert.equal(dailyStreak(doneOn(1, 2, 3), TODAY, START), 3);
  });

  it('forgives one isolated miss: it holds the run but does not count', () => {
    // Missed yesterday, today still open.
    assert.equal(dailyStreak(doneOn(2, 3, 4), TODAY, START), 3);
    // Missed two days ago, done since.
    assert.equal(dailyStreak(doneOn(0, 1, 3, 4), TODAY, START), 4);
  });

  it('two misses in a row, or two in one week, still end it', () => {
    assert.equal(dailyStreak(doneOn(3, 4, 5), TODAY, START), 0);
    assert.equal(dailyStreak(doneOn(0, 2, 4, 5), TODAY, START), 2);
  });

  it('a week apart, a second rest day is fine', () => {
    const run = [0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 16, 17];
    assert.equal(dailyStreak(doneOn(...run), TODAY, START), run.length);
  });

  it('never reaches before the challenge started', () => {
    assert.equal(dailyStreak(doneOn(0, 1, 2), TODAY, addDays(TODAY, -1)), 2);
  });
});

describe('Mochi on a missed day', () => {
  const history = (done: (d: string) => boolean): DailyHistory => ({
    goal: 1,
    history: Array.from({ length: 28 }, (_, i) => {
      const date = addDays(TODAY, -(27 - i));
      return { date, value: done(date) ? 1 : 0, active: true };
    }),
  });
  const mood = (done: (d: string) => boolean) =>
    companionMood({
      today: TODAY,
      adoptedOn: addDays(TODAY, -20),
      daily: [history(done)],
      acceptedCount: 1,
    });

  it('keeps the streak once a week, and says so', () => {
    const m = mood(doneOn(2, 3, 4, 5, 6, 7, 8));
    assert.equal(m.mood, 'sad');
    assert.match(m.line, /kept your streak/);
  });

  it('cries when it is the second miss of the week', () => {
    assert.match(mood(doneOn(2, 3, 5, 6, 7, 8)).line, /cried/);
  });
});
