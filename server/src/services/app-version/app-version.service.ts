import { eq } from 'drizzle-orm';
import { redis } from '../../config/redis';
import { db } from '../../db';
import { appVersionRules } from '../../db/schema';
import { isBlocked } from './version.math';

export const PLATFORMS = ['android', 'ios'] as const;
export type Platform = (typeof PLATFORMS)[number];

export interface VersionRule {
  platform: Platform;
  blockedThrough: string | null;
  message: string | null;
  updateUrl: string | null;
  updatedAt: string | null;
}

/**
 * The rule is read on every API request, so it's cached in Redis (shared by all instances).
 * A change through the admin route deletes the key; a direct DB edit shows up within the TTL.
 */
const CACHE_TTL_SECONDS = 300;
const cacheKey = (platform: Platform) => `app-version:${platform}`;

const DEFAULT_MESSAGE = 'This version of Nourish AI is no longer supported. Please update to keep going.';

async function fromDb(platform: Platform): Promise<VersionRule> {
  const [row] = await db.select().from(appVersionRules).where(eq(appVersionRules.platform, platform));
  return {
    platform,
    blockedThrough: row?.blockedThrough ?? null,
    message: row?.message ?? null,
    updateUrl: row?.updateUrl ?? null,
    updatedAt: row?.updatedAt.toISOString() ?? null,
  };
}

export const appVersionService = {
  async rule(platform: Platform): Promise<VersionRule> {
    // Redis down or a bad entry: fall back to the DB. A cache problem must never lock users out
    // or let a blocked build through.
    try {
      const cached = await redis.get(cacheKey(platform));
      if (cached) return JSON.parse(cached) as VersionRule;
    } catch {
      return fromDb(platform);
    }
    const rule = await fromDb(platform);
    await redis.set(cacheKey(platform), JSON.stringify(rule), 'EX', CACHE_TTL_SECONDS).catch(() => null);
    return rule;
  },

  /** Null when this build may use the API; otherwise what the "Update required" screen shows. */
  async blockFor(platform: Platform, version: string) {
    const rule = await this.rule(platform);
    if (!isBlocked(version, rule.blockedThrough)) return null;
    return { message: rule.message ?? DEFAULT_MESSAGE, updateUrl: rule.updateUrl };
  },

  async set(input: Omit<VersionRule, 'updatedAt'>): Promise<VersionRule> {
    const values = { ...input, updatedAt: new Date() };
    await db
      .insert(appVersionRules)
      .values(values)
      .onConflictDoUpdate({ target: appVersionRules.platform, set: values });
    // Clear, don't overwrite: the next read caches the row exactly as stored.
    await redis.del(cacheKey(input.platform)).catch(() => null);
    return fromDb(input.platform);
  },
};
