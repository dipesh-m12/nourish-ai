/**
 * Real-database + real-AI smoke test (run by hand: `npx tsx tests/priorities-api.smoke.ts`):
 * a report shared in "+" is remembered, and the briefing card follows it at a meal hour, then
 * goes quiet once a matching food is logged. Throwaway profile, soft-deleted.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const API = process.env.SMOKE_API ?? 'http://localhost:4034/api';

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
  // A timezone where it's 1 pm right now (lunch: the iron tip's window).
  const now = new Date();
  const tz = (13 - now.getUTCHours()) * 60 - now.getUTCMinutes();
  const local = new Date(now.getTime() + tz * 60_000);
  const date = local.toISOString().slice(0, 10);

  const signup = await call('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name: `smoke-pa-${Date.now()}` }),
  });
  const { token } = signup.body;
  try {
    await call('/me/onboarding', {
      method: 'POST',
      token,
      body: JSON.stringify({
        sex: 'female',
        age: 27,
        heightCm: 158,
        weightKg: 52,
        activityLevel: 'light',
        dietType: 'veg',
        allergies: [],
        goal: { type: 'gain_muscle', targetWeightKg: 55, why: 'Climb stairs without getting tired' },
      }),
    });

    const pdf = readFileSync(
      join(__dirname, '..', '..', 'docs', 'test-reports', 'report-3-iron-low.pdf'),
    ).toString('base64');
    const proposed = await call('/me/challenges/propose', {
      method: 'POST',
      token,
      body: JSON.stringify({ date, image: { base64: pdf, mimeType: 'application/pdf' } }),
    });
    assert.equal(proposed.status, 200, JSON.stringify(proposed.body));
    console.log('proposals:', proposed.body.proposals.map((p: { title: string }) => p.title));

    const card = await call(`/me/briefing?date=${date}&tz=${tz}`, { token });
    assert.equal(card.status, 200, JSON.stringify(card.body));
    console.log('card:', card.body.kind, '|', card.body.headline, '|', card.body.why);
    // At 1 pm with lunch not logged, "lunch time" comes first; log a meal without iron foods.
    const meal = await call('/me/meals', {
      method: 'POST',
      token,
      body: JSON.stringify({
        date,
        title: 'Curd rice',
        items: [{ name: 'Curd rice', portion: '1 bowl', proteinG: 8, carbsG: 45, fatG: 6 }],
        credits: [],
      }),
    });
    assert.ok(meal.status < 300, JSON.stringify(meal.body));
    const after = await call(`/me/briefing?date=${date}&tz=${tz}`, { token });
    console.log('after lunch:', after.body.kind, '|', after.body.headline, '|', after.body.why);
    assert.equal(after.body.kind, 'priority', 'the report leads once lunch is logged');
    assert.match(after.body.headline, /iron/i);

    const ironMeal = await call('/me/meals', {
      method: 'POST',
      token,
      body: JSON.stringify({
        date,
        title: 'Palak dal',
        items: [{ name: 'Palak dal', portion: '1 bowl', proteinG: 9, carbsG: 20, fatG: 5 }],
        credits: [],
      }),
    });
    assert.ok(ironMeal.status < 300);
    const done = await call(`/me/briefing?date=${date}&tz=${tz}`, { token });
    console.log('after palak:', done.body.kind, '|', done.body.headline);
    assert.notEqual(done.body.kind, 'priority', 'quiet once covered');
    console.log('priorities smoke: ok');
  } finally {
    await call('/me', { method: 'DELETE', token });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
