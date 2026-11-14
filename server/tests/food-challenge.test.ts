import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isFoodChallenge } from '../src/services/meals/food-challenge';

const food = (title: string, category = 'nutrition' as const) =>
  isFoodChallenge({ title, target: '1 a day', category });

describe('which challenges log as a meal photo', () => {
  it('a plate proves eating something', () => {
    assert.equal(food('Greens with lunch'), true);
    assert.equal(food('Protein at breakfast'), true);
  });

  it('planning, shopping or not eating something logs in one tap', () => {
    assert.equal(food('Plan meals in advance'), false);
    assert.equal(food('No sugar in chai'), false);
    assert.equal(food('Tea without biscuits'), false);
    assert.equal(food('Stop eating after 8 pm'), false);
  });
});
