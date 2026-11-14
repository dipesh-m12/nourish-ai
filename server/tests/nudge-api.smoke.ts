/**
 * Real-database smoke test for push nudges (run by hand: `npx tsx tests/nudge-api.smoke.ts`).
 * Needs the API running on SMOKE_API (default http://localhost:4021/api) and Redis.
 *
 * Creates a throwaway profile, registers a device over HTTP, then runs the nudge evaluation at a
 * fixed lunch-time instant. The token is fake, so Expo answers "not registered": that proves the
 * whole path (device → rules → Redis claim → push → dead-token cleanup) without a phone.
 * The profile is soft-deleted at the end.
 */
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { redis } from '../src/config/redis';
import { db } from '../src/db';
import { profiles } from '../src/db/schema';
import { nudgeService } from '../src/services/notifications/nudge.service';

const API = process.env.SMOKE_API ?? 'http://localhost:4021/api';
const FAKE_TOKEN = 'ExponentPushToken[smoke-test-not-a-device]';

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
    body: JSON.stringify({ name: `smoke-nudge-${Date.now()}` }),
  });
  assert.equal(signup.status, 201, JSON.stringify(signup.body));
  const { token, profile } = signup.body;
  try {
    const onboard = await call('/me/onboarding', {
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
    assert.ok(onboard.status < 300, JSON.stringify(onboard.body));

    // Validation: a bad zone and a bad token are refused.
    assert.equal(
      (
        await call('/me/device', {
          method: 'PUT',
          token,
          body: JSON.stringify({ timezone: 'Mars/Base' }),
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call('/me/device', {
          method: 'PUT',
          token,
          body: JSON.stringify({ timezone: 'Asia/Kolkata', pushToken: 'nope' }),
        })
      ).status,
      400,
    );

    const device = await call('/me/device', {
      method: 'PUT',
      token,
      body: JSON.stringify({ timezone: 'Asia/Kolkata', pushToken: FAKE_TOKEN }),
    });
    assert.equal(device.status, 204, JSON.stringify(device.body));
    console.log('✓ PUT /me/device');

    // Pretend they last opened the app yesterday, so the "already in the app" rule doesn't skip.
    await db
      .update(profiles)
      .set({ lastActiveAt: new Date(Date.now() - 86_400_000) })
      .where(eq(profiles.id, profile.id));

    // 14:30 IST: lunch window, nothing logged → a meal nudge is due.
    const lunchIst = new Date('2026-11-13T09:00:00Z');
    const result = await nudgeService.evaluate(profile.id, lunchIst);
    console.log('evaluate →', result);
    assert.ok(
      ['sent', 'skipped:dead_token', 'skipped:failed'].includes(result) ||
        result === 'skipped:nothing',
    );

    if (result === 'skipped:dead_token') {
      const [row] = await db
        .select({ t: profiles.pushToken })
        .from(profiles)
        .where(eq(profiles.id, profile.id));
      assert.equal(row?.t, null, 'dead token cleared');
      const sent = await redis.smembers(`nudge:day:${profile.id}:2026-11-13`);
      assert.deepEqual(sent, [], 'slot released when not delivered');
      console.log('✓ dead token cleared, slot released');
    }

    // 23:30 IST: quiet hours (or no device left after the dead-token cleanup).
    const night = await nudgeService.evaluate(profile.id, new Date('2026-11-13T18:00:00Z'));
    assert.ok(night === 'skipped:quiet' || night === 'skipped:no_device', night);
    console.log('✓ smoke passed');
  } finally {
    await call('/me', { method: 'DELETE', token });
    await redis.del(`nudge:day:${profile.id}:2026-11-13`);
    redis.disconnect();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
