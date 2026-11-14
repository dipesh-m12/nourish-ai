import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isValidZone, localTime } from '../src/services/notifications/local-time';
import {
  pickNudge,
  pickReminder,
  pickWaterNudge,
  pickWeekly,
  urlFor,
  type NudgeInput,
  type ReminderInput,
  type WaterInput,
} from '../src/services/notifications/nudge.rules';

/** Push timing must follow the user's clock. These pin it with fixed instants. */
describe('localTime', () => {
  it('IST is UTC+5:30, and the date rolls over at local midnight', () => {
    // 18:29 UTC = 23:59 IST (same day); 18:31 UTC = 00:01 IST (next day).
    assert.deepEqual(localTime('Asia/Kolkata', new Date('2026-11-13T18:29:00Z')), {
      date: '2026-11-13',
      hour: 23,
      minute: 59,
      offsetMinutes: 330,
    });
    assert.equal(localTime('Asia/Kolkata', new Date('2026-11-13T18:31:00Z')).date, '2026-11-14');
  });

  it('follows daylight saving (New York: -5 h in winter, -4 h in summer)', () => {
    assert.equal(localTime('America/New_York', new Date('2026-01-15T13:00:00Z')).hour, 8);
    assert.equal(localTime('America/New_York', new Date('2026-07-15T13:00:00Z')).hour, 9);
    assert.equal(
      localTime('America/New_York', new Date('2026-07-15T13:00:00Z')).offsetMinutes,
      -240,
    );
  });

  it('is behind UTC for zones west of it (date can be yesterday)', () => {
    assert.equal(
      localTime('America/Los_Angeles', new Date('2026-11-14T03:00:00Z')).date,
      '2026-11-13',
    );
  });

  it('validates zones', () => {
    assert.equal(isValidZone('Asia/Kolkata'), true);
    assert.equal(isValidZone('Mars/Olympus'), false);
    assert.throws(() => localTime('Mars/Olympus'));
  });
});

const base = (over: Partial<NudgeInput> = {}): NudgeInput => ({
  hour: 14,
  briefing: {
    kind: 'meal_time',
    headline: 'Lunch time.',
    actions: [{ kind: 'log_meal', label: 'Snap' }],
  },
  sentToday: [],
  minutesSinceActive: null,
  ...over,
});

describe('pickNudge', () => {
  it('sends a meal nudge late in the meal window, linked to the camera', () => {
    assert.deepEqual(pickNudge(base()), {
      key: 'meal:lunch',
      title: 'Snap your plate',
      body: 'Lunch time.',
      url: '/dashboard?open=meal',
    });
  });

  it('stays quiet at night (22:00–07:00)', () => {
    for (const hour of [22, 23, 0, 3, 6]) assert.equal(pickNudge(base({ hour })), null);
  });

  it('never sends the same nudge twice in a day', () => {
    assert.equal(pickNudge(base({ sentToday: ['meal:lunch'] })), null);
  });

  it('caps the day at MAX_PER_DAY nudges', () => {
    assert.equal(
      pickNudge(base({ sentToday: Array.from({ length: 12 }, (_, i) => `k${i}`) })),
      null,
    );
  });

  it('skips users who opened the app in the last 30 minutes', () => {
    assert.equal(pickNudge(base({ minutesSinceActive: 10 })), null);
    assert.notEqual(pickNudge(base({ minutesSinceActive: 45 })), null);
  });

  it('only pushes meal nudges in the second half of a meal window', () => {
    assert.equal(pickNudge(base({ hour: 12 })), null);
    assert.equal(pickNudge(base({ hour: 15 }))?.key, 'meal:lunch');
    assert.equal(pickNudge(base({ hour: 20 }))?.key, 'meal:dinner');
  });

  it('never nags about being over or near the limit', () => {
    for (const kind of ['over', 'near_limit', 'all_done', 'on_track'] as const)
      assert.equal(pickNudge(base({ briefing: { kind, headline: 'x', actions: [] } })), null);
  });

  it('streak nudges only in the evening', () => {
    const streak = { kind: 'streak_risk' as const, headline: 'x', actions: [] };
    assert.equal(pickNudge(base({ hour: 11, briefing: streak })), null);
    assert.equal(pickNudge(base({ hour: 20, briefing: streak }))?.key, 'streak');
  });

  it('builds deep links for every action', () => {
    assert.equal(
      urlFor({ kind: 'log_challenge', label: 'x', challengeId: 'c 1' }),
      '/dashboard?open=challenge&id=c%201',
    );
    assert.equal(
      urlFor({ kind: 'ask', label: 'x', prompt: 'how much?' }),
      '/assistant?prompt=how%20much%3F',
    );
    assert.equal(urlFor(undefined), '/dashboard');
  });
});

describe('pickWaterNudge', () => {
  const water = (over: Partial<WaterInput> = {}): WaterInput => ({
    hour: 13,
    minute: 0,
    sentToday: [],
    minutesSinceActive: null,
    consent: true,
    water: { challengeId: 'w1', value: 0.5, goal: 3, step: 0.25 },
    ...over,
  });

  it('reminds when behind pace, linked to the water glass', () => {
    const n = pickWaterNudge(water());
    assert.equal(n?.key, 'water:2'); // 13:00 is 240 min into the water day → slot 2
    assert.equal(n?.url, '/dashboard?open=challenge&id=w1');
    assert.match(n!.body, /0\.5 of 3 L/);
  });

  it('needs consent and a water challenge', () => {
    assert.equal(pickWaterNudge(water({ consent: false })), null);
    assert.equal(pickWaterNudge(water({ water: null })), null);
  });

  it('stays quiet when on pace, done, or outside 9–21', () => {
    assert.equal(
      pickWaterNudge(water({ water: { challengeId: 'w1', value: 1.5, goal: 3, step: 0.25 } })),
      null,
    );
    assert.equal(
      pickWaterNudge(water({ water: { challengeId: 'w1', value: 3, goal: 3, step: 0.25 } })),
      null,
    );
    assert.equal(pickWaterNudge(water({ hour: 8 })), null);
    assert.equal(pickWaterNudge(water({ hour: 21 })), null);
  });

  it('sends each 90-minute slot once, so several a day are possible', () => {
    assert.equal(pickWaterNudge(water({ sentToday: ['water:2'] })), null);
    assert.equal(
      pickWaterNudge(water({ hour: 14, minute: 40, sentToday: ['water:2'] }))?.key,
      'water:3',
    );
  });
});

describe('pickReminder', () => {
  const r = (over: Partial<ReminderInput> = {}): ReminderInput => ({
    hour: 7,
    minute: 32,
    sentToday: [],
    reminders: [
      {
        challengeId: 'walk',
        title: 'Morning walk',
        why: 'lighter legs all day',
        remindAt: '07:30',
        done: false,
      },
    ],
    ...over,
  });

  it('fires in the 10 minutes after the chosen time, even early morning', () => {
    const n = pickReminder(
      r({ hour: 6, minute: 31, reminders: [{ ...r().reminders[0]!, remindAt: '06:30' }] }),
    );
    assert.equal(n?.key, 'remind:walk:06:30');
    assert.equal(n?.body, 'Lighter legs all day.');
    assert.equal(n?.url, '/dashboard?open=challenge&id=walk');
    assert.notEqual(pickReminder(r()), null);
  });

  it('not before, not after the window, not twice, not when done', () => {
    assert.equal(pickReminder(r({ minute: 29 })), null);
    assert.equal(pickReminder(r({ minute: 40 })), null);
    assert.equal(pickReminder(r({ sentToday: ['remind:walk:07:30'] })), null);
    // A new time the same day is a new reminder, not a repeat.
    assert.notEqual(pickReminder(r({ sentToday: ['remind:walk:06:00'] })), null);
    assert.equal(pickReminder(r({ reminders: [{ ...r().reminders[0]!, done: true }] })), null);
  });
});

describe('pickWeekly', () => {
  it('Sunday 18–20 once, linking to the check-in', () => {
    assert.equal(pickWeekly({ date: '2026-11-15', hour: 18, sentToday: [] })?.url, '/week'); // a Sunday
    assert.equal(pickWeekly({ date: '2026-11-15', hour: 20, sentToday: [] }), null);
    assert.equal(pickWeekly({ date: '2026-11-14', hour: 18, sentToday: [] }), null); // Saturday
    assert.equal(pickWeekly({ date: '2026-11-15', hour: 19, sentToday: ['week'] }), null);
  });
});
