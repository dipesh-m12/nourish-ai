/**
 * Real-database + real-AI smoke test for reminders (run by hand: `npx tsx tests/reminders-api.smoke.ts`).
 * Words → plan (nothing saved) → confirm in one PUT → today shows the times. Throwaway profile.
 */
import assert from 'node:assert/strict';

const API = process.env.SMOKE_API ?? 'http://localhost:4032/api';
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

const item = (title: string, category: string) => ({
  title,
  target: '1 a day',
  why: 'feel better',
  frequency: 'daily',
  category,
  endsOn: null,
});

async function main() {
  const signup = await call('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name: `smoke-rem-${Date.now()}` }),
  });
  const { token } = signup.body;
  try {
    const created = await call('/me/challenges', {
      method: 'POST',
      token,
      body: JSON.stringify({
        date: today,
        items: [
          item('Morning walk', 'movement'),
          item('Drink water', 'hydration'),
          item('Sleep by 11', 'sleep'),
        ],
      }),
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const [walk, water, sleep] = created.body as { id: string }[];

    await call('/me/reminders', {
      method: 'PUT',
      token,
      body: JSON.stringify({ items: [{ id: sleep!.id, remindAt: '22:00' }] }),
    });

    const plan = await call('/me/reminders/plan', {
      method: 'POST',
      token,
      body: JSON.stringify({
        date: today,
        text: 'remind me to walk at 7 in the morning and water at 9, no sleep reminder, and stop the water sips',
      }),
    });
    assert.equal(plan.status, 200, JSON.stringify(plan.body));
    console.log(plan.body);
    const by = new Map(
      plan.body.changes.map((c: { id: string; remindAt: string | null }) => [c.id, c.remindAt]),
    );
    assert.equal(by.get(walk!.id), '07:00');
    assert.equal(by.get(water!.id), '09:00');
    assert.equal(by.get(sleep!.id), null);
    assert.equal(plan.body.water, false);

    const before = await call(`/me/today?date=${today}&tz=330`, { token });
    assert.equal(
      before.body.challenges.find((c: { id: string }) => c.id === walk!.id).remindAt,
      null,
      'plan saves nothing',
    );

    const apply = await call('/me/reminders', {
      method: 'PUT',
      token,
      body: JSON.stringify({
        items: plan.body.changes.map((c: { id: string; remindAt: string | null }) => ({
          id: c.id,
          remindAt: c.remindAt,
        })),
        water: plan.body.water,
      }),
    });
    assert.equal(apply.status, 200);
    const after = await call(`/me/today?date=${today}&tz=330`, { token });
    const t = (id: string) =>
      after.body.challenges.find((c: { id: string }) => c.id === id).remindAt;
    assert.equal(t(walk!.id), '07:00');
    assert.equal(t(sleep!.id), null);

    const foreign = await call('/me/reminders', {
      method: 'PUT',
      token,
      body: JSON.stringify({
        items: [{ id: '00000000-0000-4000-8000-000000000000', remindAt: '08:00' }],
      }),
    });
    assert.equal(foreign.status, 404, 'someone else’s id refused');
    console.log('reminders smoke: ok');
  } finally {
    await call('/me', { method: 'DELETE', token });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
