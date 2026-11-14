import { and, eq, gte, isNull, lt, or } from 'drizzle-orm';
import { challenges } from '../../db/schema';

/**
 * Challenges that run on the user's local `date`: taken on, and not past their last day.
 * Expiry is read lazily like this (no cron flips a status), so it follows each user's calendar.
 */
export function activeChallenges(profileId: string, date: string) {
  return and(
    eq(challenges.profileId, profileId),
    eq(challenges.accepted, true),
    or(isNull(challenges.endsOn), gte(challenges.endsOn, date)),
  );
}

/** Taken on but past their last day: waiting for "keep going" or "done". */
export function endedChallenges(profileId: string, date: string) {
  return and(
    eq(challenges.profileId, profileId),
    eq(challenges.accepted, true),
    lt(challenges.endsOn, date),
  );
}
