/**
 * Manual live check (run by hand: `npx tsx tests/chat-priorities.manual.ts`) with the real AI:
 * a concern told in chat is remembered, and the next chat turn uses it. Throwaway profile.
 */
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '../src/db';
import { profiles, userSignals } from '../src/db/schema';
import { agentService } from '../src/services/agent/agent.service';
import { authService } from '../src/services/auth.service';
import { profileService } from '../src/services/profile.service';

async function main() {
  const { profile } = await authService.signUp({ name: `manual-chat-${Date.now()}` });
  try {
    await profileService.completeOnboarding(profile.id, {
      sex: 'male',
      age: 41,
      heightCm: 170,
      weightKg: 82,
      activityLevel: 'sedentary',
      dietType: 'veg',
      allergies: [],
      goal: { type: 'lose_weight', targetWeightKg: 75, why: 'Play football with my son' },
    } as never);
    const date = new Date().toISOString().slice(0, 10);
    const say = async (text: string) => {
      const r = await agentService.send(profile.id, { date, tz: 330, text });
      return r.messages.at(-1)?.text;
    };
    console.log('1 →', await say('my knees hurt when I climb stairs'));
    const rows = await db.select().from(userSignals).where(eq(userSignals.profileId, profile.id));
    console.log('remembered:', rows.map((r) => r.focus));
    console.log('2 →', await say('what should I do this evening?'));
  } finally {
    await db.update(profiles).set({ deletedAt: new Date() }).where(eq(profiles.id, profile.id));
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
