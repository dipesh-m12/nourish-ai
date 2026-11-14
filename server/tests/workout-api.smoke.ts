/**
 * Real-database smoke test for Move workouts (run by hand: `npx tsx tests/workout-api.smoke.ts`).
 * A yoga workout with no challenge: start → finish → logged as an activity (burn moves),
 * linked to its session (trophy). Throwaway profile, soft-deleted.
 */
import assert from 'node:assert/strict';

const API = process.env.SMOKE_API ?? 'http://localhost:4033/api';
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
    body: JSON.stringify({ name: `smoke-workout-${Date.now()}` }),
  });
  const { token } = signup.body;
  try {
    await call('/me/onboarding', {
      method: 'POST',
      token,
      body: JSON.stringify({
        sex: 'female',
        age: 29,
        heightCm: 162,
        weightKg: 60,
        activityLevel: 'light',
        dietType: 'veg',
        allergies: [],
        goal: { type: 'lose_weight', targetWeightKg: 56, why: 'Feel calm' },
      }),
    });
    const before = await call(`/me/today?date=${today}&tz=330`, { token });

    // A real library exercise, as the exercise page's Start sends it.
    const lib = await call(`/me/exercises?date=${today}&limit=1`, { token });
    const exercise = lib.body.items[0] as { id: string; name: string };
    const s = await call('/me/sessions', {
      method: 'POST',
      token,
      body: JSON.stringify({
        kind: 'timer',
        date: today,
        data: { title: exercise.name, exerciseId: exercise.id },
      }),
    });
    assert.equal(s.status, 201, JSON.stringify(s.body));

    const bad = await call('/me/sessions', {
      method: 'POST',
      token,
      body: JSON.stringify({ kind: 'timer', date: today, data: { activity: 'sleep' } }),
    });
    assert.equal(bad.status, 400, 'sleep is not a workout');

    const done = await call(`/me/sessions/${s.body.id}/finish`, {
      method: 'POST',
      token,
      body: JSON.stringify({ date: today, data: { movingMs: 10 * 60_000, metres: 0, pauses: 0 } }),
    });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    assert.ok(done.body.calories > 0, 'kcal from MET × kg × time');

    const after = await call(`/me/today?date=${today}&tz=330`, { token });
    const act = after.body.burn.activities.find(
      (a: { sessionId: string | null }) => a.sessionId === s.body.id,
    );
    assert.ok(act, 'the workout is an activity linked to its trophy');
    assert.equal(act.minutes, 10);
    assert.equal(act.label, exercise.name, 'logged under the exercise’s own name');
    assert.ok(after.body.burn.active > before.body.burn.active, 'active burn moved');
    const todayBar = after.body.burn.week.at(-1);
    assert.equal(todayBar.total, after.body.burn.total, 'week chart matches the big number');
    console.log('workout smoke: ok', { kcal: done.body.calories, total: after.body.burn.total });
  } finally {
    await call('/me', { method: 'DELETE', token });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
