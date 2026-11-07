import { z } from 'zod';

export const startSessionSchema = z.object({
  profileId: z.uuid(),
});

export type StartSessionInput = z.infer<typeof startSessionSchema>;
