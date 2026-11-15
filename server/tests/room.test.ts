import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { DailyHistory } from '../src/services/companion/companion.rules';
import { roomView, updateRoom } from '../src/services/companion/room.rules';
import { addDays, lastNDays } from '../src/utils/dates';

const TODAY = '2026-11-16'; // a Monday: last week (11-09 → 11-15) just finished
const ADOPTED = '2026-10-26'; // a Monday, three full weeks before

/** One daily challenge, done on the given dates. */
const habit = (done: Set<string>): DailyHistory => ({
  goal: 1,
  history: lastNDays(TODAY, 28).map((date) => ({
    date,
    value: done.has(date) ? 1 : 0,
    active: date >= ADOPTED,
  })),
});
const days = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i));

describe('Mochi’s room', () => {
  it('each finished week with 5 full days adds the next item, once', () => {
    const done = new Set([
      ...days('2026-10-26', 5), // week 1: 5 days → item
      ...days('2026-11-02', 3), // week 2: 3 days → nothing
      ...days('2026-11-09', 7), // week 3: 7 days → item
    ]);
    const first = updateRoom(undefined, [habit(done)], TODAY, ADOPTED);
    assert.equal(first.state.items, 2);
    assert.equal(first.state.through, '2026-11-15');
    assert.equal(first.changed, true);

    // Same week again: nothing new, nothing to save.
    const again = updateRoom(first.state, [habit(done)], TODAY, ADOPTED);
    assert.equal(again.state.items, 2);
    assert.equal(again.changed, false);
  });

  it('a partial week before adoption does not count', () => {
    const done = new Set(days('2026-11-09', 7));
    const r = updateRoom(undefined, [habit(done)], TODAY, '2026-11-11');
    assert.equal(r.state.items, 0);
  });

  it('shows this week’s full days and the new item for two days', () => {
    const done = new Set([...days('2026-11-09', 5), TODAY]);
    const { state } = updateRoom(undefined, [habit(done)], TODAY, '2026-11-09');
    const view = roomView(state, [habit(done)], TODAY);
    assert.deepEqual(view, { unlocked: 1, full: 1, need: 5, newItem: 'rug' });
    assert.equal(roomView(state, [habit(done)], addDays(TODAY, 3)).newItem, null);
  });
});
