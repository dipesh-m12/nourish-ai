import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../config/env';
import * as schema from './schema';

/**
 * Neon (and laptops that sleep) drop idle connections; the next query on a dead socket fails
 * with ECONNRESET. So: TCP keep-alive, short idle life, and one retry for plain queries when
 * the connection itself died (never for transactions, which run on their own client).
 */
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  keepAlive: true,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

// A connection dying while idle in the pool must not crash the process.
pool.on('error', (err) => console.warn('[db] idle connection dropped:', err.message));

const DEAD_SOCKET = new Set(['ECONNRESET', 'EPIPE', 'ETIMEDOUT', '57P01']);
const isDeadSocket = (err: unknown) =>
  err instanceof Error &&
  (DEAD_SOCKET.has((err as { code?: string }).code ?? '') ||
    /Connection terminated/i.test(err.message));

const query = pool.query.bind(pool) as (...args: unknown[]) => Promise<unknown>;
pool.query = (async (...args: unknown[]) => {
  try {
    return await query(...args);
  } catch (err) {
    if (!isDeadSocket(err)) throw err;
    console.warn('[db] retrying after a dropped connection');
    return query(...args);
  }
}) as typeof pool.query;

export const db = drizzle(pool, { schema });
