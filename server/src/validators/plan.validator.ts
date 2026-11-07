import { z } from 'zod';

export const acceptChallengesSchema = z.object({
  /** Ids of the suggested challenges the user ticked. Empty = took none on. */
  acceptedIds: z.array(z.uuid()).max(20),
});

export type AcceptChallengesInput = z.infer<typeof acceptChallengesSchema>;
