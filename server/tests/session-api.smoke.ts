/**
 * Real-database smoke test for walk/timer sessions (run by hand: `npx tsx tests/session-api.smoke.ts`).
 * Start → checkpoint → today shows it running → finish logs the challenge + links the activity
 * → double finish refused → timer cancel. Throwaway profile, soft-deleted.
 */
import assert from 'node:assert/strict';

const API = process.env.SMOKE_API ?? 'http://localhost:4031/api';
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
    body: JSON.stringify({ name: `smoke-session-${Date.now()}` }),
  });
  const { token } = signup.body;
  try {
    await call('/me/onboarding', {
      method: 'POST',
      token,
      body: JSON.stringify({
        sex: 'male',
        age: 32,
        heightCm: 175,
        weightKg: 78,
        activityLevel: 'light',
        dietType: 'veg',
        allergies: [],
        goal: { type: 'lose_weight', targetWeightKg: 72, why: 'More energy' },
      }),
    });
    const created = await call('/me/challenges', {
      method: 'POST',
      token,
      body: JSON.stringify({
        date: today,
        items: [
          {
            title: 'Morning walk',
            target: '20 min',
            why: 'lighter legs',
            frequency: 'daily',
            category: 'movement',
            endsOn: null,
          },
        ],
      }),
    });
    const walkId = created.body[0].id;

    const started = await call('/me/sessions', {
      method: 'POST',
      token,
      body: JSON.stringify({ kind: 'walk', challengeId: walkId, date: today, data: { title: 'Morning walk' } }),
    });
    assert.equal(started.status, 201, JSON.stringify(started.body));
    const id = started.body.id;

    const bad = await call(`/me/sessions/${id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ data: { hacked: true } }),
    });
    assert.equal(bad.status, 400, 'unknown data fields are refused');

    const cp = await call(`/me/sessions/${id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ data: { metres: 420, movingMs: 300000, path: [[77.1, 28.6], [77.101, 28.601]] } }),
    });
    assert.equal(cp.status, 200);
    assert.equal(cp.body.data.title, 'Morning walk', 'checkpoint merges, keeps the title');

    const day = await call(`/me/today?date=${today}&tz=330`, { token });
    const card = day.body.challenges.find((c: { id: string }) => c.id === walkId);
    assert.equal(card.session?.id, id, 'today shows the walk still running');

    const done = await call(`/me/sessions/${id}/finish`, {
      method: 'POST',
      token,
      body: JSON.stringify({ date: today, amount: 12, data: { metres: 1100, movingMs: 720000, steps: 1400, pauses: 2 } }),
    });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    assert.equal(done.body.amount, 12);
    assert.ok(done.body.calories > 0, 'burn computed');
    assert.equal(done.body.session.status, 'finished');

    const again = await call(`/me/sessions/${id}/finish`, {
      method: 'POST',
      token,
      body: JSON.stringify({ date: today, amount: 12 }),
    });
    assert.equal(again.status, 409, 'double finish refused');

    const after = await call(`/me/today?date=${today}&tz=330`, { token });
    const walk = after.body.challenges.find((c: { id: string }) => c.id === walkId);
    assert.equal(walk.progress.value, 12, 'challenge credited once');
    assert.equal(walk.session, null);
    const act = after.body.burn.activities.find((a: { sessionId: string | null }) => a.sessionId === id);
    assert.ok(act, 'activity links to the trophy');

    const trophy = await call(`/me/sessions/${id}`, { token });
    assert.equal(trophy.body.data.metres, 1100);
    assert.equal(trophy.body.data.path.length, 2);

    const timer = await call('/me/sessions', {
      method: 'POST',
      token,
      body: JSON.stringify({ kind: 'timer', date: today, data: { minutes: 5 } }),
    });
    const active = await call('/me/sessions/active', { token });
    assert.equal(active.body.sessions.length, 1);
    const cancel = await call(`/me/sessions/${timer.body.id}/cancel`, { method: 'POST', token });
    assert.equal(cancel.status, 204);
    console.log('session smoke: ok');
  } finally {
    await call('/me', { method: 'DELETE', token });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
