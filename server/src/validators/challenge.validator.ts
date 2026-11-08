import { z } from 'zod';
import { imageInputSchema } from './image.validator';

/** The user's local calendar day, e.g. 2026-11-08. */
export const localDate = z.iso.date();

export const todayQuerySchema = z.object({
  date: localDate,
  /** Minutes east of UTC (e.g. 330 for India), to place timestamps on the user's calendar. */
  tz: z.coerce.number().int().min(-720).max(840).default(0),
});

export const logProgressSchema = z.object({
  date: localDate,
  image: imageInputSchema,
  /** How much was done, in the challenge's unit (e.g. 1 L of water). Defaults to one step. */
  amount: z.number().positive().max(10_000).optional(),
});

export const challengeIdParamSchema = z.object({ id: z.uuid() });

export type LogProgressInput = z.infer<typeof logProgressSchema>;
