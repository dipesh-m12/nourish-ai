import { z } from 'zod';

export const createFeedbackSchema = z.object({
  type: z.enum(['bug', 'idea', 'other']),
  message: z
    .string()
    .trim()
    .min(5, 'Tell us a bit more (at least 5 characters)')
    .max(1000, 'Please keep it under 1000 characters'),
  context: z
    .object({
      platform: z.string().max(20).optional(),
      osVersion: z.string().max(40).optional(),
      appVersion: z.string().max(20).optional(),
    })
    .default({}),
});

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
