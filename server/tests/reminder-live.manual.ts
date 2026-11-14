/**
 * Manual live check (run by hand: `npx tsx tests/reminder-live.manual.ts <challengeTitle> <minutesAhead>`):
 * sets that challenge's reminder N minutes ahead on the newest push-enabled profile's own clock
 * and queues the exact-time job, then prints when it should arrive. Needs the worker running.
 */
import 'dotenv/config';
import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import { db } from '../src/db';
import { challenges, profiles } from '../src/db/schema';
import { challengeGoalService } from '../src/services/challenges/challenge-goal.service';
import { localTime } from '../src/services/notifications/local-time';
import { nudgeService } from '../src/services/notifications/nudge.service';
import { queue } from '../src/services/queue';

async function main() {
  const [title, ahead = '2'] = process.argv.slice(2);
  const [p] = await db
    .select({ id: profiles.id, zone: profiles.timezone })
    .from(profiles)
    .where(and(isNull(profiles.deletedAt), isNotNull(profiles.pushToken)))
    .orderBy(desc(profiles.createdAt))
    .limit(1);
  if (!p?.zone) throw new Error('no push-enabled profile');
  const [c] = await db
    .select({ id: challenges.id, title: challenges.title })
    .from(challenges)
    .where(and(eq(challenges.profileId, p.id), eq(challenges.accepted, true), eq(challenges.title, title!)))
    .limit(1);
  if (!c) throw new Error(`no accepted challenge "${title}"`);
  const at = localTime(p.zone, new Date(Date.now() + Number(ahead) * 60_000));
  const hhmm = `${String(at.hour).padStart(2, '0')}:${String(at.minute).padStart(2, '0')}`;
  await challengeGoalService.setReminder(p.id, c.id, hhmm);
  const queued = await nudgeService.scheduleExact(p.id);
  console.log(`${c.title}: reminder ${hhmm} (${p.zone}), exact jobs queued: ${queued}`);
  await queue().close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
