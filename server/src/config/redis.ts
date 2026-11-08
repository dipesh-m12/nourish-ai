import { Redis } from 'ioredis';
import { env } from './env';

/**
 * One shared Redis connection (single host + port from env: localhost in dev, the Redis
 * container's service name on EKS). Used for short-lived coordination such as checkout
 * idempotency, never as a source of truth.
 *
 * Commands fail fast while disconnected (no offline queue, one try per request), so callers can
 * fail closed with a clear message instead of hanging. The client keeps reconnecting with backoff.
 */
export const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  connectTimeout: 5000,
  retryStrategy: (attempt) => Math.min(attempt * 500, 5000),
});

let lastError = '';
redis.on('ready', () => {
  lastError = '';
  console.log(`[redis] connected to ${env.REDIS_HOST}:${env.REDIS_PORT}`);
});
redis.on('error', (err: Error) => {
  // Log once per distinct error, not on every reconnect attempt.
  if (err.message !== lastError) console.warn('[redis]', err.message);
  lastError = err.message;
});

/** For /health (EKS readiness probe). */
export async function redisHealthy() {
  try {
    return (await redis.ping()) === 'PONG';
  } catch {
    return false;
  }
}
