import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  suggestReminders,
  type SuggestInput,
} from '../src/services/reminders/reminder-suggest.rules';

const c = (over: Partial<SuggestInput>): SuggestInput => ({
  id: 'x',
  title: 'Habit',
  target: '20 min',
  category: 'movement',
  frequency: 'daily',
  remindAt: null,
  ...over,
});

describe('suggested reminders', () => {
  it('picks a time by kind of habit, earliest first', () => {
    const s = suggestReminders(
      [
        c({ id: 'walk' }),
        c({ id: 'sleep', category: 'sleep' }),
        c({ id: 'food', category: 'nutrition' }),
      ],
      false,
    );
    assert.deepEqual(
      s.changes.map((x) => [x.id, x.remindAt]),
      [
        ['food', '12:30'],
        ['walk', '18:30'],
        ['sleep', '22:00'],
      ],
    );
  });

  it('spreads habits that would share a time, around ones already set', () => {
    const s = suggestReminders(
      [c({ id: 'set', remindAt: '18:30' }), c({ id: 'a' }), c({ id: 'b' })],
      false,
    );
    assert.deepEqual(
      s.changes.map((x) => x.remindAt),
      ['19:00', '19:30'],
    );
  });

  it('water uses sips, not a fixed time; weekly habits are left alone', () => {
    const s = suggestReminders(
      [c({ id: 'w', category: 'hydration' }), c({ id: 'wk', frequency: 'weekly' })],
      false,
    );
    assert.equal(s.changes.length, 0);
    assert.equal(s.water, true);
    assert.equal(suggestReminders([c({ category: 'hydration' })], true).water, null);
  });

  it('follows the habit words and times before the category', () => {
    const at = (title: string, category = 'movement', target = '20 min') =>
      suggestReminders([c({ title, category, target })], false).changes[0]!.remindAt;
    assert.equal(at('Morning brisk walk'), '07:00');
    assert.equal(at('Walk after dinner'), '20:30');
    assert.equal(at('Add veg protein snack', 'nutrition'), '16:30');
    assert.equal(at('Protein at breakfast', 'nutrition'), '08:00');
    assert.equal(at('Lights out', 'sleep', '11 pm'), '22:30');
    assert.equal(at('Yoga', 'movement', '7:30 am'), '07:15');
    assert.equal(at('Stretch'), '18:30'); // no hint: the category's time
  });
});
