import { z } from 'zod';
import { localDate } from './challenge.validator';

export const exerciseListQuerySchema = z.object({
  date: localDate,
  q: z.string().trim().max(60).optional(),
  category: z.string().max(40).optional(),
  muscle: z.string().max(40).optional(),
  level: z.enum(['beginner', 'intermediate', 'expert']).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const exerciseDateQuerySchema = z.object({ date: localDate });

/** Provider ids look like "Air_Bike" or "3_4_Sit-Up". */
export const exerciseIdParamSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[\w-]+$/),
});
