import { redis } from '../../config/redis';
import type { BriefingInput } from './briefing.rules';
import { demoScenarios } from './briefing.demo';

/** Demo mode's switch and position, per profile, in Redis (off by itself after a day). */
const KEY = (profileId: string) => `demo:briefing:${profileId}`;
const TTL_S = 24 * 60 * 60;

export const briefingDemo = {
  async set(profileId: string, on: boolean) {
    if (on) await redis.set(KEY(profileId), '0', 'EX', TTL_S);
    else await redis.del(KEY(profileId));
  },

  /** On: the next scenario's input (advances one step per call). Off: null. */
  async next(profileId: string, real: BriefingInput) {
    const at = await redis.get(KEY(profileId)).catch(() => null);
    if (at === null) return null;
    const list = demoScenarios(real);
    if (!list.length) return null;
    await redis.set(KEY(profileId), String(Number(at) + 1), 'KEEPTTL').catch(() => undefined);
    const s = list[Number(at) % list.length]!;
    return { id: s.id, input: s.build(real) };
  },
};
