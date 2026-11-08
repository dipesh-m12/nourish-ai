import { z } from 'zod';
import { localDate } from './challenge.validator';
import { imageInputSchema } from './image.validator';

const tz = z.coerce.number().int().min(-720).max(840).default(0);

export const agentOpenQuerySchema = z.object({ date: localDate, tz });

export const agentMessageSchema = z.object({
  date: localDate,
  tz,
  text: z.string().trim().min(1, 'Say something first').max(500),
  image: imageInputSchema.optional(),
});

/** Card edits (amount, items) plus the proof photo. Each field is re-checked by the service. */
export const agentConfirmSchema = z.object({
  date: localDate,
  tz,
  image: imageInputSchema.optional(),
  minutes: z.number().int().min(1).max(600).optional(),
  calories: z.number().int().min(1).max(3000).optional(),
  amount: z.number().positive().max(10_000).optional(),
  hours: z.number().min(0.5).max(14).optional(),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        portion: z.string().trim().max(40),
        proteinG: z.number().min(0).max(1500),
        carbsG: z.number().min(0).max(1500),
        fatG: z.number().min(0).max(1500),
      }),
    )
    .min(1)
    .max(12)
    .optional(),
});

export const agentActionIdParamSchema = z.object({ id: z.uuid() });

export type AgentConfirmInput = z.infer<typeof agentConfirmSchema>;
