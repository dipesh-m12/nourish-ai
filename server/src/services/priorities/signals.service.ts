import { and, desc, eq, gte } from 'drizzle-orm';
import { db } from '../../db';
import { userSignals, type ReportFinding } from '../../db/schema';
import { prioritiesFrom, type Priorities } from './priorities.rules';

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
      kind: 'ask' | 'report' | 'photo';
      said: string | null;
      focus: string;
      findings: ReportFinding[];
    },
  ) {
    // Nothing worth remembering (an empty ask the AI couldn't read): skip the row.
    if (!s.focus.trim() && !s.findings.length && !s.said?.trim()) return;
    try {
      await db.insert(userSignals).values({
        profileId,
        kind: s.kind,
        said: s.said?.trim().slice(0, 400) || null,
        focus: s.focus.trim().slice(0, 60) || null,
        findings: s.findings,
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
};
