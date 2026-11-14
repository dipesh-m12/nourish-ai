import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { endsOnFor, extendBy } from '../src/services/challenges/expiry';
import { challengeAmountFromActivity } from '../src/services/burn/burn.math';
import { waterTargetL } from '../src/services/metrics.service';

/** Expiry follows the user's calendar: "today" ends tonight, N days counts today. */
describe('endsOnFor', () => {
  it('"just today" ends today (ended from tomorrow)', () => {
    assert.deepEqual(endsOnFor('2026-11-13', 'today', 0), { endsOn: '2026-11-13', ask: false });
  });
  it('N days includes today, and crosses months', () => {
    assert.equal(endsOnFor('2026-11-13', 'days', 7).endsOn, '2026-11-19');
    assert.equal(endsOnFor('2026-11-28', 'days', 7).endsOn, '2026-12-04');
  });
  it('clamps silly spans', () => {
    assert.equal(endsOnFor('2026-11-13', 'days', 0).endsOn, '2026-11-13');
    assert.equal(endsOnFor('2026-01-01', 'days', 500).endsOn, '2026-03-31');
  });
  it('ongoing has no end; unknown asks the user', () => {
    assert.deepEqual(endsOnFor('2026-11-13', 'ongoing', 0), { endsOn: null, ask: false });
    assert.deepEqual(endsOnFor('2026-11-13', 'unknown', 0), { endsOn: null, ask: true });
  });
});

describe('extendBy', () => {
  it('extends a running challenge from its last day', () => {
    assert.equal(extendBy('2026-11-13', '2026-11-15', 7), '2026-11-22');
  });
  it('restarts an ended one from today', () => {
    assert.equal(extendBy('2026-11-13', '2026-11-10', 7), '2026-11-19');
  });
  it('keeps ongoing ongoing', () => {
    assert.equal(extendBy('2026-11-13', null, 7), null);
  });
});

describe('waterTargetL', () => {
  it('scales with weight and activity, in quarter litres', () => {
    assert.equal(waterTargetL(70, 'light'), 2.75); // 2.45 + 0.25 = 2.7 → 2.75
    assert.equal(waterTargetL(55, 'sedentary'), 2); // 1.925 → 2
    assert.equal(waterTargetL(90, 'active'), 4); // 3.15 + 0.75 = 3.9 → 4 (cap)
  });
  it('stays within 1.5–4 L', () => {
    assert.equal(waterTargetL(35, null), 1.5);
    assert.equal(waterTargetL(150, 'very_active'), 4);
  });
});

describe('challengeAmountFromActivity', () => {
  const walk = { title: 'Evening walk', category: 'movement' as const };
  const t = (unit: string) => ({
    kind: 'amount' as const,
    unit,
    target: 30,
    step: 5,
    widget: 'bars' as const,
    proof: '',
  });
  it('credits the same kind of movement in the challenge unit', () => {
    assert.equal(
      challengeAmountFromActivity({ kind: 'brisk_walk', minutes: 20 }, walk, t('min')),
      20,
    );
    assert.equal(challengeAmountFromActivity({ kind: 'walk', minutes: 24 }, walk, t('km')), 2);
    assert.equal(
      challengeAmountFromActivity({ kind: 'walk', minutes: 30 }, walk, t('steps')),
      3000,
    );
  });
  it('ignores other kinds and units it cannot derive', () => {
    assert.equal(challengeAmountFromActivity({ kind: 'yoga', minutes: 20 }, walk, t('min')), null);
    assert.equal(challengeAmountFromActivity({ kind: 'walk', minutes: 20 }, walk, t('sets')), null);
  });
});
