/**
 * Real-database smoke test for the weekly check-in and activity → challenge credit
 * (run by hand: `npx tsx tests/week-api.smoke.ts`). Throwaway profile, soft-deleted.
 */
import assert from 'node:assert/strict';

const API = process.env.SMOKE_API ?? 'http://localhost:4021/api';
const today = new Date().toISOString().slice(0, 10);

async function call(path: string, init: RequestInit & { token?: string } = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.token && { authorization: `Bearer ${init.token}` }),
    },
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function main() {
  const signup = await call('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name: `smoke-week-${Date.now()}` }),
  });
  const { token } = signup.body;
  try {
    await call('/me/onboarding', {
      method: 'POST',
      token,
      body: JSON.stringify({
        sex: 'female',
        age: 30,
        heightCm: 165,
        weightKg: 70,
        activityLevel: 'light',
        dietType: 'veg',
        allergies: [],
        goal: { type: 'lose_weight', targetWeightKg: 64, why: 'Keep up with my kids' },
      }),
    });
    const created = await call('/me/challenges', {
      method: 'POST',
      token,
      body: JSON.stringify({
        date: today,
        items: [
          {
            title: 'Evening walk',
            target: '30 min',
            why: 'lighter legs',
            frequency: 'daily',
            category: 'movement',
            endsOn: null,
          },
        ],
      }),
    });
    const walkId = created.body[0].id;

    // A walk logged from "Move → Activity" also moves the walking challenge.
    const act = await call('/me/activities', {
      method: 'POST',
      token,
      body: JSON.stringify({ date: today, kind: 'brisk_walk', minutes: 20 }),
    });
    assert.equal(act.status, 201, JSON.stringify(act.body));
    console.log('activity →', act.body.credited);
    assert.equal(act.body.credited?.challengeId, walkId);

    let day = await call(`/me/today?date=${today}&tz=330`, { token });
    const walk = day.body.challenges.find((c: { id: string }) => c.id === walkId);
    assert.equal(walk.progress.value, 20);

    // Removing the activity takes the credit back.
    const del = await call(`/me/activities/${act.body.activity.id}`, { method: 'DELETE', token });
    assert.equal(del.status, 204, JSON.stringify(del.body));
    day = await call(`/me/today?date=${today}&tz=330`, { token });
    assert.equal(day.body.challenges.find((c: { id: string }) => c.id === walkId).progress.value, 0);
    console.log('✓ activity credit added and removed');

    const week = await call(`/me/week?date=${today}&tz=330`, { token });
    assert.equal(week.status, 200, JSON.stringify(week.body));
    console.log('week →', JSON.stringify(week.body));
    assert.equal(week.body.trend, 'first');
    console.log('✓ smoke passed');
  } finally {
    await call('/me', { method: 'DELETE', token });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
