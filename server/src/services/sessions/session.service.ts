import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import { challenges, sessions, type SessionData } from '../../db/schema';
import { AppError } from '../../utils/app-error';
import type { LogActivityInput } from '../../validators/activity.validator';
import type {
  FinishSessionInput,
  SessionDataInput,
  StartSessionInput,
} from '../../validators/session.validator';
import { burnService } from '../burn/burn.service';
import { challengeProgressService } from '../challenges/challenge-progress.service';

type Session = typeof sessions.$inferSelect;

function toView(s: Session) {
  return {
    id: s.id,
    kind: s.kind,
    status: s.status,
    challengeId: s.challengeId,
    date: s.localDate,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    data: s.data,
  };
}

async function mine(profileId: string, id: string) {
  const [row] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, id), eq(sessions.profileId, profileId)))
    .limit(1);
  if (!row) throw AppError.notFound('Session');
  return row;
}

/** Only a running session changes; a finished one is a keepsake. */
function mustBeActive(s: Session) {
  if (s.status !== 'active') throw new AppError(409, 'This session has already ended');
}

/**
 * Walks and timers that survive the app closing. The start time is stored when it begins, so
 * on return the app adds the time that passed; finishing logs the challenge (through the normal
 * service, so burn and streaks follow) and keeps the card.
 */
export const sessionService = {
  async start(profileId: string, input: StartSessionInput) {
    if (input.challengeId) {
      const [c] = await db
        .select({ id: challenges.id })
        .from(challenges)
        .where(and(eq(challenges.id, input.challengeId), eq(challenges.profileId, profileId)))
        .limit(1);
      if (!c) throw AppError.notFound('Challenge');
    }
    return db.transaction(async (tx) => {
      // One walk (or timer) at a time: starting again replaces the one left behind.
      await tx
        .update(sessions)
        .set({ status: 'cancelled', endedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(sessions.profileId, profileId),
            eq(sessions.kind, input.kind),
            eq(sessions.status, 'active'),
          ),
        );
      const [row] = await tx
        .insert(sessions)
        .values({
          profileId,
          challengeId: input.challengeId ?? null,
          kind: input.kind,
          localDate: input.date,
          data: input.data,
        })
        .returning();
      return toView(row!);
    });
  },

  async active(profileId: string) {
    const rows = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.profileId, profileId), eq(sessions.status, 'active')))
      .orderBy(desc(sessions.startedAt));
    return { sessions: rows.map(toView) };
  },

  async get(profileId: string, id: string) {
    return toView(await mine(profileId, id));
  },

  /** A checkpoint while running (distance so far, route): merged into what's stored. */
  async update(profileId: string, id: string, data: SessionDataInput) {
    mustBeActive(await mine(profileId, id));
    const [row] = await db
      .update(sessions)
      .set({ data: sql`${sessions.data} || ${JSON.stringify(data)}::jsonb`, updatedAt: new Date() })
      .where(and(eq(sessions.id, id), eq(sessions.status, 'active')))
      .returning();
    if (!row) throw new AppError(409, 'This session has already ended');
    return toView(row);
  },

  async finish(profileId: string, id: string, input: FinishSessionInput) {
    const session = await mine(profileId, id);
    mustBeActive(session);
    // Claim it first, so a double tap can't log the walk twice.
    const [claimed] = await db
      .update(sessions)
      .set({ status: 'finished', endedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(sessions.id, id), eq(sessions.status, 'active')))
      .returning({ id: sessions.id });
    if (!claimed) throw new AppError(409, 'This session has already ended');

    let calories: number | null = null;
    let amount = 0;
    const data = { ...session.data, ...input.data };
    const workoutMinutes = Math.round((data.movingMs ?? 0) / 60_000);
    // A workout or library exercise with no challenge: it's an activity (burn moves, and a
    // matching challenge, e.g. a walk, is credited by the same call).
    if (!session.challengeId && (data.activity || data.exerciseId) && workoutMinutes >= 1) {
      try {
        const result = await burnService.log(
          profileId,
          {
            date: input.date,
            minutes: Math.min(600, workoutMinutes),
            // A library exercise brings its own kind, name and MET; otherwise the plain kind
            // (both validated when the session was saved: session.validator).
            ...(data.exerciseId
              ? { exerciseId: data.exerciseId }
              : { kind: data.activity as LogActivityInput['kind'] }),
          },
          { sessionId: id },
        );
        calories = result.activity.calories;
      } catch (err) {
        await db
          .update(sessions)
          .set({ status: 'active', endedAt: null })
          .where(eq(sessions.id, id));
        throw err;
      }
    }
    if (session.challengeId && input.amount && input.amount > 0) {
      try {
        const result = await challengeProgressService.log(
          profileId,
          session.challengeId,
          input.date,
          undefined,
          input.amount,
          session.kind === 'walk' ? 'walk' : 'timer',
          id,
        );
        if (result.verified) {
          amount = result.amount;
          calories = 'burned' in result ? (result.burned?.calories ?? null) : null;
        }
      } catch (err) {
        // Logging failed (e.g. the challenge ended): reopen it so nothing is lost.
        await db
          .update(sessions)
          .set({ status: 'active', endedAt: null })
          .where(eq(sessions.id, id));
        throw err;
      }
    }

    const saved: SessionData = { ...data, calories };
    const [row] = await db
      .update(sessions)
      .set({ data: saved, updatedAt: new Date() })
      .where(eq(sessions.id, id))
      .returning();
    return { session: toView(row!), amount, calories };
  },

  async cancel(profileId: string, id: string) {
    mustBeActive(await mine(profileId, id));
    await db
      .update(sessions)
      .set({ status: 'cancelled', endedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(sessions.id, id), eq(sessions.status, 'active')));
  },
};
