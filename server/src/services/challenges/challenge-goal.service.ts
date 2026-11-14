import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../../db';
import { activities, challenges, goals, profiles } from '../../db/schema';
import { addDays } from '../../utils/dates';
import { AppError } from '../../utils/app-error';
import { looksLikeReport, type ReportUpload } from '../../validators/image.validator';
import type {
  CreateChallengesInput,
  UpdateExpiryInput,
} from '../../validators/challenge.validator';
import { generateStructured } from '../ai/ai.service';
import { activeChallenges } from './active';
import { GOAL_SYSTEM_PROMPT, goalProposalSchema } from './challenge-goal.prompt';
import { signalsService } from '../priorities/signals.service';
import { duplicates } from './duplicate';
import { endsOnFor, extendBy } from './expiry';

/** More than this on one day stops being doable; the app asks to finish one first. */
const MAX_ACTIVE = 8;

async function owned(profileId: string, id: string) {
  const [row] = await db
    .select()
    .from(challenges)
    .where(and(eq(challenges.id, id), eq(challenges.profileId, profileId)))
    .limit(1);
  if (!row || !row.accepted) throw AppError.notFound('Challenge');
  return row;
}

export const challengeGoalService = {
  /**
   * "What do you want to achieve?" → 1–3 proposals. Nothing is saved: the user keeps or drops
   * each one first. The AI reads intent; dates are computed here.
   */
  async propose(profileId: string, input: { date: string; text?: string; image?: ReportUpload }) {
    if (
      input.image &&
      !looksLikeReport(Buffer.from(input.image.base64, 'base64'), input.image.mimeType)
    )
      throw new AppError(400, 'That file isn’t a photo or a PDF');

    const [profile, goal, active, recent] = await Promise.all([
      db.query.profiles.findFirst({ where: eq(profiles.id, profileId) }),
      db.query.goals.findFirst({ where: eq(goals.profileId, profileId) }),
      db
        .select({
          title: challenges.title,
          target: challenges.target,
          category: challenges.category,
        })
        .from(challenges)
        .where(activeChallenges(profileId, input.date)),
      // What they already do (last 7 days), so a new idea never repeats it under another name.
      db
        .select({
          kind: activities.kind,
          name: activities.exerciseName,
          times: sql<number>`count(*)::int`,
          minutes: sql<number>`round(sum(${activities.minutes}))::int`,
        })
        .from(activities)
        .where(
          and(
            eq(activities.profileId, profileId),
            gte(activities.localDate, addDays(input.date, -6)),
            lte(activities.localDate, input.date),
          ),
        )
        .groupBy(activities.kind, activities.exerciseName),
    ]);
    if (!profile) throw AppError.notFound('Profile');

    let result;
    try {
      result = await generateStructured(
        goalProposalSchema,
        {
          system: GOAL_SYSTEM_PROMPT,
          user: JSON.stringify({
            age: profile.age,
            sex: profile.sex,
            activityLevel: profile.activityLevel,
            dietType: profile.dietType,
            allergies: profile.allergies,
            goal: goal ? { type: goal.type, why: goal.why } : null,
            activeChallenges: active,
            doneLast7Days: recent.map((r) => ({
              activity: r.name ?? r.kind,
              times: r.times,
              minutes: r.minutes,
            })),
            said: input.text ?? null,
            sentPhoto: input.image?.mimeType.startsWith('image/') ?? false,
            sentPdfReport: input.image?.mimeType === 'application/pdf',
          }),
          ...(input.image && { images: [input.image] }),
        },
        undefined,
        // Words alone go to the fast provider (the user is waiting with the sheet open).
        { fast: !input.image },
      );
    } catch (err) {
      console.warn('[goal] AI failed:', err instanceof Error ? err.message : err);
      throw new AppError(503, 'Couldn’t think that through right now. Try again in a moment.');
    }

    // Remember what they care about, so the PA can follow it (briefing, nudges, chat).
    await signalsService.record(profileId, {
      kind: input.image ? (input.image.mimeType === 'application/pdf' ? 'report' : 'photo') : 'ask',
      said: input.text ?? null,
      focus: result.data.focus,
      findings: result.data.findings,
    });

    // The model is told not to repeat what's running, but doesn't always listen: code has the
    // last word (pure, tested in tests/duplicate.test.ts).
    const fresh = result.data.challenges.filter((c) => !duplicates(c, active));
    const covered = result.data.challenges.length > 0 && fresh.length === 0;
    return {
      reply: covered ? 'You already have this covered.' : result.data.reply,
      proposals: fresh.map(({ duration, days, ...c }) => ({
        ...c,
        ...endsOnFor(input.date, duration, days),
      })),
      full: active.length >= MAX_ACTIVE,
    };
  },

  /** Saves what the user kept, taken on straight away. */
  async create(profileId: string, { date, items }: CreateChallengesInput) {
    const active = await db
      .select({ id: challenges.id })
      .from(challenges)
      .where(activeChallenges(profileId, date));
    if (active.length + items.length > MAX_ACTIVE)
      throw new AppError(409, `Up to ${MAX_ACTIVE} at a time. Finish one first.`);
    for (const i of items)
      if (i.endsOn !== null && i.endsOn < date) throw new AppError(400, 'End date is in the past');

    return db
      .insert(challenges)
      .values(
        items.map((i) => ({
          ...i,
          profileId,
          source: 'user',
          accepted: true,
          acceptedAt: new Date(),
        })),
      )
      .returning({
        id: challenges.id,
        title: challenges.title,
        target: challenges.target,
        endsOn: challenges.endsOn,
      });
  },

  /** Keep going (+N days / ongoing / custom day). Works on running and just-ended challenges. */
  async updateExpiry(profileId: string, id: string, input: UpdateExpiryInput) {
    const row = await owned(profileId, id);
    let endsOn: string | null;
    if (input.extendDays) endsOn = extendBy(input.date, row.endsOn, input.extendDays);
    else if (input.endsOn !== undefined) endsOn = input.endsOn;
    else throw new AppError(400, 'Say how long');
    if (endsOn !== null && endsOn < input.date) throw new AppError(400, 'End date is in the past');

    const [saved] = await db
      .update(challenges)
      .set({ endsOn })
      .where(eq(challenges.id, row.id))
      .returning({ id: challenges.id, endsOn: challenges.endsOn });
    return saved!;
  },

  /** Daily reminder for this challenge at a local time (sent by the nudge worker), or off. */
  async setReminder(profileId: string, id: string, remindAt: string | null) {
    const row = await owned(profileId, id);
    await db.update(challenges).set({ remindAt }).where(eq(challenges.id, row.id));
    return { id: row.id, remindAt };
  },

  /** Pin the place for a "get there" challenge (or clear it). */
  async setPlace(
    profileId: string,
    id: string,
    place: { lat: number; lng: number; radiusM: number } | null,
  ) {
    const row = await owned(profileId, id);
    await db.update(challenges).set({ place }).where(eq(challenges.id, row.id));
    return { id: row.id, place };
  },

  /** Done with it: off the day, history kept (logs stay for the weekly look-back). */
  async finish(profileId: string, id: string) {
    const row = await owned(profileId, id);
    await db
      .update(challenges)
      .set({ accepted: false, acceptedAt: null })
      .where(eq(challenges.id, row.id));
  },
};
