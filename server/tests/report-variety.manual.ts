/**
 * Manual check (run by hand: `npx tsx tests/report-variety.manual.ts`): each sample report in
 * docs/test-reports should give challenges that fit what it shows. Nothing is saved.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
  for (const file of ['report-1-vitamins-low.pdf', 'report-2-sugar-cholesterol-high.pdf']) {
    const base64 = readFileSync(join(__dirname, '..', '..', 'docs', 'test-reports', file)).toString('base64');
    const r = await challengeGoalService.propose(p!.id, {
      date,
      image: { base64, mimeType: 'application/pdf' },
    });
    console.log(`\n${file} → ${r.reply}`);
    for (const c of r.proposals) console.log(`  - ${c.title} · ${c.target} · ${c.why}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
