/**
 * Real-database smoke test for health reports (run by hand: `npx tsx tests/report-api.smoke.ts <file.pdf>`).
 * Needs the API on SMOKE_API and a Gemini key (only Gemini reads PDFs). Throwaway profile, soft-deleted.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const API = process.env.SMOKE_API ?? 'http://localhost:4021/api';
const today = new Date().toISOString().slice(0, 10);
const pdf = {
  mimeType: 'application/pdf',
  base64: readFileSync(process.argv[2]!).toString('base64'),
};

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
    body: JSON.stringify({ name: `smoke-report-${Date.now()}` }),
  });
  const { token } = signup.body;
  try {
    await call('/me/onboarding', {
      method: 'POST',
      token,
      body: JSON.stringify({
        sex: 'male',
        age: 34,
        heightCm: 172,
        weightKg: 78,
        activityLevel: 'sedentary',
        dietType: 'veg',
        allergies: [],
        goal: { type: 'eat_healthier', targetWeightKg: null, why: 'More energy for work' },
      }),
    });

    // A fake PDF (wrong magic bytes) is refused.
    const fake = await call('/me/challenges/propose', {
      method: 'POST',
      token,
      body: JSON.stringify({
        date: today,
        image: { mimeType: 'application/pdf', base64: 'A'.repeat(200) },
      }),
    });
    assert.equal(fake.status, 400);

    const proposed = await call('/me/challenges/propose', {
      method: 'POST',
      token,
      body: JSON.stringify({ date: today, image: pdf }),
    });
    console.log('propose(pdf) →', proposed.status, JSON.stringify(proposed.body, null, 1));
    assert.equal(proposed.status, 200);
    assert.ok(proposed.body.proposals.length >= 1);

    const chat = await call('/me/agent/messages', {
      method: 'POST',
      token,
      body: JSON.stringify({ date: today, tz: 330, text: 'My blood report', report: pdf }),
    });
    assert.equal(chat.status, 200, JSON.stringify(chat.body));
    const last = chat.body.messages.at(-1);
    console.log('chat →', last.text, last.action?.kind, JSON.stringify(last.action?.payload));
    assert.equal(last.action?.kind, 'create_challenges');

    const ok = await call(`/me/agent/actions/${last.action.id}/confirm`, {
      method: 'POST',
      token,
      body: JSON.stringify({ date: today, tz: 330 }),
    });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    const day = await call(`/me/today?date=${today}`, { token });
    console.log(
      'challenges now →',
      day.body.challenges.map((c: { title: string; target: string }) => `${c.title} · ${c.target}`),
    );
    assert.ok(day.body.challenges.length >= 1);
    console.log('✓ smoke passed');
  } finally {
    await call('/me', { method: 'DELETE', token });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
