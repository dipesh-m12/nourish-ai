import { z } from 'zod';

/**
 * One assistant turn, as the model must return it. Deliberately flat with "none" sentinels
 * instead of unions: every provider's structured output handles it reliably.
 */
export const turnSchema = z.strictObject({
  /** What the assistant says. Short. */
  say: z.string().min(1).max(500),
  /** An inline input for the user's next answer. */
  ask: z.strictObject({
    /** photo: the app shows camera/gallery and sends the picture back (client-side tool). */
    kind: z.enum(['none', 'choice', 'number', 'photo']),
    options: z.array(z.string().max(32)).max(6),
    unit: z.string().max(12),
    min: z.number(),
    max: z.number(),
    step: z.number(),
    initial: z.number(),
  }),
  /** Something to do. Becomes a card; nothing happens until the user confirms. */
  propose: z.strictObject({
    kind: z.enum([
      'none',
      'log_meal',
      'log_activity',
      'log_challenge',
      'log_sleep',
      'change_challenges',
      'remove_last',
    ]),
    /** log_meal: the food in the user's words, with portions ("2 rotis, 1 bowl dal"). */
    mealText: z.string().max(300),
    /** log_activity: one of our activity kinds, or '' when using exerciseQuery. */
    activity: z.string().max(20),
    /** log_activity: a library exercise to look up, e.g. "push up" ('' if none). */
    exerciseQuery: z.string().max(60),
    minutes: z.number(),
    calories: z.number(),
    /** log_challenge: one of the given challenge ids. */
    challengeId: z.string().max(40),
    amount: z.number(),
    /** log_sleep */
    hours: z.number(),
    /** change_challenges: ids from the plan's challenge list. */
    acceptIds: z.array(z.string().max(40)).max(10),
    dropIds: z.array(z.string().max(40)).max(10),
    /** remove_last */
    removeTarget: z.enum(['none', 'meal', 'activity']),
  }),
  /**
   * Look something up first (server-side tools): the server runs it, adds the result to the
   * conversation and asks the model again. Data tools return fresh numbers from the database.
   */
  read: z.strictObject({
    tool: z.enum([
      'none',
      'get_today',
      'get_challenges',
      'get_meals',
      'get_activities',
      'get_profile',
      'search_exercises',
      'suggest_exercises',
    ]),
    query: z.string().max(60),
  }),
});

export type Turn = z.infer<typeof turnSchema>;
export type Proposal = Turn['propose'];
