import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { duplicates } from '../src/services/challenges/duplicate';

const running = [
  { title: 'Morning Walk', category: 'movement' as const },
  { title: 'Drink water', category: 'hydration' as const },
  { title: 'Protein bowl', category: 'nutrition' as const },
];

describe('duplicate challenges', () => {
  it('catches the same habit under another name', () => {
    assert.equal(duplicates({ title: 'Brisk walking', category: 'movement' }, running), true);
    assert.equal(duplicates({ title: 'Protein at lunch', category: 'nutrition' }, running), true);
  });

  it('allows only one water and one sleep challenge', () => {
    assert.equal(duplicates({ title: 'Hourly sips', category: 'hydration' }, running), true);
    assert.equal(duplicates({ title: 'Phone away by 10', category: 'sleep' }, running), false);
  });

  it('lets genuinely new ideas through', () => {
    assert.equal(duplicates({ title: 'Wall sits', category: 'movement' }, running), false);
    assert.equal(duplicates({ title: 'No sugar in chai', category: 'nutrition' }, running), false);
  });

  it('ignores filler words when matching', () => {
    assert.equal(duplicates({ title: 'Morning stretch', category: 'movement' }, running), false);
  });
});
