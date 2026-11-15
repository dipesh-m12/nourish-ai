import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildBriefing,
  type BriefingChallenge,
  type BriefingInput,
} from '../src/services/briefing/briefing.rules';

const challenge = (over: Partial<BriefingChallenge>): BriefingChallenge => ({
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

const base: BriefingInput = {
  name: 'Asha',
  hour: 9,
  diet: 'veg',
  allergies: [],
  why: 'Keep up with my daughter',
  targets: { calories: 1800, proteinG: 70 },
  eaten: { calories: 300, proteinG: 10 },
  mealHours: [8],
  sleepMinutes: 0,
  challenges: [],
  findings: [],
  foods: ['poha'],
  suggestions: [],
  weighInDue: false,
  remindersDue: false,
};

describe('briefing actions always point at something real', () => {
  it('no sleep challenge: never asks to log sleep', () => {
    const b = buildBriefing(base);
    assert.notEqual(b.kind, 'sleep');
  });

  it('a sleep challenge: logs it in one tap', () => {
    const sleep = challenge({ id: 's1', label: 'Sleep', category: 'sleep', unit: 'h', goal: 7 });
    const b = buildBriefing({ ...base, challenges: [sleep] });
    assert.equal(b.kind, 'sleep');
    assert.deepEqual(b.actions[0], {
      kind: 'log_challenge',
      label: 'Log Sleep',
      challengeId: 's1',
    });
  });

  it('a report habit logs their own challenge for it, or offers to add one', () => {
    const vitD = {
      marker: 'Vitamin D',
      value: '14',
      unit: 'ng/mL',
      flag: 'low',
      area: 'vitamin_d',
    } as const;
    const none = buildBriefing({ ...base, findings: [vitD] });
    assert.equal(none.kind, 'priority');
    assert.equal(none.actions[0]!.kind, 'ask');

    const sun = challenge({ id: 'sun', label: 'Morning sunlight' });
    const has = buildBriefing({ ...base, findings: [vitD], challenges: [sun] });
    assert.deepEqual(has.actions[0], {
      kind: 'log_challenge',
      label: 'Log Morning sunlight',
      challengeId: 'sun',
    });

    const done = buildBriefing({ ...base, findings: [vitD], challenges: [{ ...sun, done: true }] });
    assert.notEqual(done.kind, 'priority');
  });

  it('all done with few habits: offers one more from an area they do not cover', () => {
    const b = buildBriefing({
      ...base,
      hour: 18,
      mealHours: [8, 13],
      eaten: { calories: 1200, proteinG: 60 },
      challenges: [
        challenge({ done: true, value: 20 }),
        challenge({ id: 'c2', label: 'Steps', done: false, frequency: 'weekly' }),
      ],
      suggestions: [
        {
          id: 'p1',
          title: 'Evening stretch',
          category: 'movement',
          target: '10 min',
          why: 'looser back',
        },
        {
          id: 'p2',
          title: 'Phone away by 10:30',
          category: 'sleep',
          target: 'daily',
          why: 'wake up fresh',
        },
      ],
    });
    assert.equal(b.kind, 'all_done');
    assert.equal(b.suggestion?.id, 'p2');
    assert.doesNotMatch(b.headline, /Phone away/); // the idea lives in the row, not the headline
  });

  it('no daily habit at all: suggests one', () => {
    const b = buildBriefing({
      ...base,
      hour: 18,
      mealHours: [8, 13],
      eaten: { calories: 1200, proteinG: 60 },
      suggestions: [
        {
          id: 'p1',
          title: 'Evening stretch',
          category: 'movement',
          target: '10 min',
          why: 'looser back',
        },
      ],
    });
    assert.equal(b.kind, 'suggest');
  });

  it('late at night only says rest', () => {
    const b = buildBriefing({ ...base, hour: 2, challenges: [challenge({})] });
    assert.equal(b.actions.length, 0);
    assert.match(b.headline, /late/i);
  });

  it('a weight goal a week in: asks for the weight, which opens the check-in', () => {
    const b = buildBriefing({ ...base, weighInDue: true });
    assert.equal(b.kind, 'checkin');
    assert.deepEqual(b.actions[0], { kind: 'checkin', label: 'Log it' });
  });

  it('habits with no reminders: offers picked times once, in waking hours', () => {
    const due = { ...base, remindersDue: true, challenges: [challenge({})] };
    const b = buildBriefing({ ...due, hour: 10 });
    assert.equal(b.kind, 'reminders');
    assert.deepEqual(b.actions[0], { kind: 'reminders', label: 'See times' });
    assert.notEqual(buildBriefing({ ...due, hour: 21 }).kind, 'reminders');
    assert.notEqual(buildBriefing({ ...due, challenges: [] }).kind, 'reminders');
  });

  it('the morning after a perfect week: offers the step up before today is done', () => {
    const walk = challenge({ id: 'w', streak: 7, levelUp: 25, done: false, value: 0 });
    const b = buildBriefing({
      ...base,
      hour: 9,
      sleepMinutes: 420,
      mealHours: [8],
      challenges: [walk],
    });
    assert.equal(b.kind, 'level_up');
  });
});
