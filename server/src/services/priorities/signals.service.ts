import { and, desc, eq, gte, isNotNull, sql } from 'drizzle-orm';
import { db } from '../../db';
import { userSignals, type ReportFinding } from '../../db/schema';
import { markerTrends, prioritiesFrom, type Priorities } from './priorities.rules';

/** Older rows never matter: the longest window in priorities.rules is 120 days. */
const LOOKBACK_DAYS = 120;

/**
 * The user's own priorities: what they asked for in "+", what their reports showed. Written
 * when they ask; read by the briefing card, nudges and the assistant.
 */
export const signalsService = {
  async record(
    profileId: string,
    s: {
      kind: 'ask' | 'report' | 'photo' | 'status';
      said: string | null;
      focus: string;
      findings: ReportFinding[];
      weightKg?: number | null;
      at?: Date;
    },
  ) {
    // Nothing worth remembering (an empty ask the AI couldn't read): skip the row.
    if (!s.focus.trim() && !s.findings.length && !s.said?.trim() && !s.weightKg) return;
    try {
      await db.insert(userSignals).values({
        profileId,
        kind: s.kind,
        said: s.said?.trim().slice(0, 400) || null,
        focus: s.focus.trim().slice(0, 60) || null,
        findings: s.findings,
        weightKg: s.weightKg ?? null,
        ...(s.at && { createdAt: s.at }),
      });
    } catch (err) {
      // Memory is a bonus: never fail the user's request over it.
      console.warn('[signals] not recorded:', err instanceof Error ? err.message : err);
    }
  },

  async priorities(profileId: string, now = new Date()): Promise<Priorities> {
    const rows = await db
      .select({
        focus: userSignals.focus,
        findings: userSignals.findings,
        createdAt: userSignals.createdAt,
      })
      .from(userSignals)
      .where(
        and(
          eq(userSignals.profileId, profileId),
          gte(userSignals.createdAt, new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000)),
        ),
      )
      .orderBy(desc(userSignals.createdAt))
      .limit(50);
    return prioritiesFrom(
      rows.map((r) => ({ focus: r.focus, findings: r.findings, at: r.createdAt.getTime() })),
      now.getTime(),
    );
  },

  /** Their weigh-ins, newest first (the goal's own outcome, for the week and the PA). */
  async weighIns(profileId: string, limit = 10) {
    return db
      .select({ kg: userSignals.weightKg, at: userSignals.createdAt })
      .from(userSignals)
      .where(and(eq(userSignals.profileId, profileId), isNotNull(userSignals.weightKg)))
      .orderBy(desc(userSignals.createdAt))
      .limit(limit) as Promise<{ kg: number; at: Date }[]>;
  },

  /** Each health area from their reports (last year), latest against the one before. */
  async markers(profileId: string, now = new Date()) {
    const rows = await db
      .select({ findings: userSignals.findings, createdAt: userSignals.createdAt })
      .from(userSignals)
      .where(
        and(
          eq(userSignals.profileId, profileId),
          gte(userSignals.createdAt, new Date(now.getTime() - 365 * 86_400_000)),
          sql`jsonb_array_length(${userSignals.findings}) > 0`,
        ),
      )
      .orderBy(desc(userSignals.createdAt))
      .limit(20);
    return markerTrends(
      rows.map((r) => ({ focus: null, findings: r.findings, at: r.createdAt.getTime() })),
    );
  },
};
