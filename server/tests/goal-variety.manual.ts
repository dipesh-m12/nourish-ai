/**
 * Manual check (run by hand: `npx tsx tests/goal-variety.manual.ts`): three very different asks
 * for the newest real profile should give different challenges. Nothing is saved.
 */
import 'dotenv/config';
import { and, desc, isNotNull, isNull } from 'drizzle-orm';
import { db } from '../src/db';
import { profiles } from '../src/db/schema';
import { challengeGoalService } from '../src/services/challenges/challenge-goal.service';

async function main() {
  const [p] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(isNull(profiles.deletedAt), isNotNull(profiles.pushToken)))
    .orderBy(desc(profiles.createdAt))
    .limit(1);
  const date = new Date().toISOString().slice(0, 10);
  const asks = process.argv.slice(2);
  for (const text of asks.length ? asks : [
    'I want to sleep better, I wake up tired',
    'my knees hurt when I climb stairs',
    'I snack on biscuits every evening, want to stop',
  ]) {
    const r = await challengeGoalService.propose(p!.id, { date, text });
    console.log(`\n"${text}" → ${r.reply}`);
    for (const c of r.proposals) console.log(`  - ${c.title} · ${c.target} · ${c.why}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
