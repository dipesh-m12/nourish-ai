import { and, asc, eq, gt, isNotNull, isNull } from 'drizzle-orm';
import { redis } from '../../config/redis';
import { db } from '../../db';
import { challenges, goals, profiles } from '../../db/schema';
import { briefingService } from '../briefing/briefing.service';
import { localTime } from './local-time';
import { activeChallenges } from '../challenges/active';
import {
  MAX_PER_DAY,
  pickNudge,
  pickReminder,
  pickWaterNudge,
  pickWeekly,
  quietHours,
} from './nudge.rules';
import { queue } from '../queue';
import { pushService } from './push.service';
import { sentLog } from './sent-log.buffer';

/**
 * Proactive nudges: for one user, look at their day on their own clock and push the one thing
 * worth interrupting for (or nothing). Called by the queue consumer, one job per user.
 *
 * Duplicates are prevented in Redis, before sending: `nudge:day:{profile}:{localDate}` is the set
 * of nudges sent that day. A Lua script adds the key only if it's new and the day isn't full, so
 * two workers (or a retried job) can't both send it. The DB log is history, written in batches.
 */

const DAY_TTL_S = 36 * 60 * 60;
const dayKey = (profileId: string, date: string) => `nudge:day:${profileId}:${date}`;

/** 1 = claimed (send it), 0 = already sent today or the day is full. */
const CLAIM = `
if redis.call('sismember', KEYS[1], ARGV[1]) == 1 then return 0 end
if redis.call('scard', KEYS[1]) >= tonumber(ARGV[2]) then return 0 end
redis.call('sadd', KEYS[1], ARGV[1])
redis.call('expire', KEYS[1], tonumber(ARGV[3]))
return 1`;

const SCAN_PAGE = 1000;
/** A bit more than one scan interval, so no reminder falls between two scans. */
const LOOKAHEAD_MIN = 15;

export const nudgeService = {
  /** Users who can get pushes: onboarded, not deleted, with a device token and a timezone. */
  async *targets(): AsyncGenerator<string[]> {
    let after = '00000000-0000-0000-0000-000000000000';
    for (;;) {
      const page = await db
        .select({ id: profiles.id })
        .from(profiles)
        .innerJoin(goals, eq(goals.profileId, profiles.id))
        .where(
          and(
            isNull(profiles.deletedAt),
            isNotNull(profiles.pushToken),
            isNotNull(profiles.timezone),
            gt(profiles.id, after),
          ),
        )
        .orderBy(asc(profiles.id))
        .limit(SCAN_PAGE);
      if (!page.length) return;
      yield page.map((p) => p.id);
      after = page[page.length - 1]!.id;
    }
  },

  /**
   * Reminders arrive at their exact minute: the 10-minute scan alone could be up to 10 minutes
   * late. Any reminder due within the next LOOKAHEAD_MIN gets a delayed evaluate job set for
   * that minute. Called on every scan and right after a reminder is saved. The job id holds
   * the time, so a changed time gets its own job; the old one fires, finds nothing due, and
   * does nothing.
   */
  async scheduleExact(profileId: string, now = new Date()) {
    const [p] = await db
      .select({ zone: profiles.timezone })
      .from(profiles)
      .where(and(eq(profiles.id, profileId), isNull(profiles.deletedAt)));
    if (!p?.zone) return 0;
    const local = localTime(p.zone, now);
    const rows = await db
      .select({ id: challenges.id, remindAt: challenges.remindAt })
      .from(challenges)
      .where(and(activeChallenges(profileId, local.date), isNotNull(challenges.remindAt)));
    const nowMin = local.hour * 60 + local.minute;
    const intoMinuteMs = now.getSeconds() * 1000 + now.getMilliseconds();
    const jobs = rows.flatMap((r) => {
      const [h, m] = r.remindAt!.split(':').map(Number);
      const ahead = h! * 60 + m! - nowMin;
      if (ahead < 0 || ahead >= LOOKAHEAD_MIN) return [];
      return [
        {
          name: 'nudge.evaluate',
          data: { profileId },
          opts: {
            // No ':' in BullMQ custom ids.
            jobId: `remind-${profileId}-${r.id}-${local.date}-${r.remindAt!.replace(':', '')}`,
            // A second past the minute, so the rule sees the reminder as due.
            delayMs: Math.max(0, ahead * 60_000 - intoMinuteMs + 1000),
          },
        },
      ];
    });
    if (jobs.length) await queue().enqueueMany('nudges', jobs);
    return jobs.length;
  },

  async evaluate(profileId: string, now = new Date()) {
    const [p] = await db
      .select({
        token: profiles.pushToken,
        zone: profiles.timezone,
        lastActiveAt: profiles.lastActiveAt,
        preferences: profiles.preferences,
      })
      .from(profiles)
      .where(and(eq(profiles.id, profileId), isNull(profiles.deletedAt)));
    if (!p?.token || !p.zone) return 'skipped:no_device' as const;

    const local = localTime(p.zone, now);
    const key = dayKey(profileId, local.date);

    // Reminders the user set run on their own clock, even inside quiet hours.
    const withReminder = await db
      .select({
        id: challenges.id,
        title: challenges.title,
        why: challenges.why,
        remindAt: challenges.remindAt,
      })
      .from(challenges)
      .where(and(activeChallenges(profileId, local.date), isNotNull(challenges.remindAt)));

    // Cheap exit before loading the whole day.
    if (quietHours(local.hour) && !withReminder.length) return 'skipped:quiet' as const;

    const sentToday = await redis.smembers(key);
    if (sentToday.length >= MAX_PER_DAY) return 'skipped:full' as const;

    const { rules, input } = await briefingService.rulesFor(
      profileId,
      local.date,
      local.offsetMinutes,
    );
    const minutesSinceActive = p.lastActiveAt
      ? Math.floor((now.getTime() - p.lastActiveAt.getTime()) / 60000)
      : null;
    const water = input.challenges.find(
      (c) => c.category === 'hydration' && /^(l|litres?|liters?)$/i.test(c.unit ?? ''),
    );
    const doneIds = new Set(input.challenges.filter((c) => c.done).map((c) => c.id));
    // What the user asked for first, then the day's one insight, then a water reminder.
    const nudge =
      pickReminder({
        hour: local.hour,
        minute: local.minute,
        sentToday,
        reminders: withReminder.map((r) => ({
          challengeId: r.id,
          title: r.title,
          why: r.why,
          remindAt: r.remindAt!,
          done: doneIds.has(r.id),
        })),
      }) ??
      pickWeekly({ date: local.date, hour: local.hour, sentToday }) ??
      (quietHours(local.hour)
        ? null
        : pickNudge({ hour: local.hour, briefing: rules, sentToday, minutesSinceActive })) ??
      pickWaterNudge({
        hour: local.hour,
        minute: local.minute,
        sentToday,
        minutesSinceActive,
        consent: p.preferences.reminders?.water === true,
        water: water
          ? { challengeId: water.id, value: water.value, goal: water.goal, step: water.step }
          : null,
      });
    if (!nudge) return 'skipped:nothing' as const;

    const claimed = await redis.eval(CLAIM, 1, key, nudge.key, MAX_PER_DAY, DAY_TTL_S);
    if (claimed !== 1) return 'skipped:claimed' as const;

    const result = await pushService.send(profileId, p.token, nudge).catch(() => 'failed' as const);
    if (result !== 'sent') {
      // Not delivered: free the slot so a retry (or the next scan) can try again.
      await redis.srem(key, nudge.key);
      if (result === 'failed') throw new Error('push failed'); // the queue retries with backoff
      return `skipped:${result}` as const;
    }

    sentLog.add({
      profileId,
      key: nudge.key,
      localDate: local.date,
      title: nudge.title,
      body: nudge.body,
      url: nudge.url,
    });
    return 'sent' as const;
  },
};
