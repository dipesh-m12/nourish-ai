import { randomUUID } from 'node:crypto';
import { redis } from '../../config/redis';
import { AppError } from '../../utils/app-error';

/**
 * Checkout idempotency in Redis, per user:
 *   checkout:lock:{profileId}  → only one request at a time may create a subscription (30 s)
 *   checkout:sub:{profileId}   → the subscription made for this checkout (15 min); any repeat
 *                                tap in that window gets the same one back, never a second.
 * The 15 min matches the Razorpay subscription's `expire_by`, so an abandoned checkout can't be
 * paid later. Paid or abandoned → both keys are cleared; an app killed mid-way → TTLs expire.
 */

const LOCK_TTL_MS = 30_000;
export const CHECKOUT_TTL_MS = 15 * 60 * 1000;
/** How long a losing double tap waits for the winner's subscription id. */
const WAIT_MS = 4000;
const POLL_MS = 150;

const lockKey = (profileId: string) => `checkout:lock:${profileId}`;
const subKey = (profileId: string) => `checkout:sub:${profileId}`;

/** Deletes the lock only if it's still ours (a slow request must not free someone else's). */
const RELEASE = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;

/** Payments must not guess: if Redis is unreachable, refuse clearly instead of risking a double. */
function unavailable(err: unknown): never {
  console.warn('[checkout-lock] redis unavailable:', err instanceof Error ? err.message : err);
  throw new AppError(503, 'Payments are busy right now. Please try again in a moment.');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const checkoutLock = {
  /**
   * Runs `create` at most once per user per checkout window and returns its subscription id.
   * Concurrent or repeated calls get the same id back.
   */
  async once(profileId: string, create: () => Promise<string>): Promise<string> {
    try {
      const cached = await redis.get(subKey(profileId));
      if (cached) return cached;

      const token = randomUUID();
      const won = await redis.set(lockKey(profileId), token, 'PX', LOCK_TTL_MS, 'NX');
      if (!won) return this.waitForWinner(profileId);

      try {
        // Re-check under the lock: a request that finished just before we got it.
        const again = await redis.get(subKey(profileId));
        if (again) return again;
        const subscriptionId = await create();
        await redis.set(subKey(profileId), subscriptionId, 'PX', CHECKOUT_TTL_MS);
        return subscriptionId;
      } finally {
        await redis.eval(RELEASE, 1, lockKey(profileId), token).catch(() => {});
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      return unavailable(err);
    }
  },

  async waitForWinner(profileId: string): Promise<string> {
    for (let waited = 0; waited < WAIT_MS; waited += POLL_MS) {
      await sleep(POLL_MS);
      const id = await redis.get(subKey(profileId));
      if (id) return id;
    }
    throw new AppError(409, 'Checkout is already starting. Please wait a moment.');
  },

  /** The subscription of the user's open checkout, if any. */
  async current(profileId: string): Promise<string | null> {
    try {
      return await redis.get(subKey(profileId));
    } catch (err) {
      return unavailable(err);
    }
  },

  /** Paid or abandoned: the next checkout starts fresh. */
  async clear(profileId: string) {
    await redis.del(lockKey(profileId), subKey(profileId)).catch((err: unknown) => {
      // TTLs will clear it anyway; just note it.
      console.warn('[checkout-lock] clear failed:', err instanceof Error ? err.message : err);
    });
  },
};
