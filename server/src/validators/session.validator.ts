import { z } from 'zod';
import { activityKindEnum } from '../db/schema';

const localDate = z.iso.date();

/** What a walk or timer keeps. Bounded so a bad client can't store anything huge. */
export const sessionDataSchema = z
  .object({
    minutes: z.number().positive().max(240),
    movingMs: z.number().min(0).max(86_400_000),
    metres: z.number().min(0).max(200_000),
    steps: z.number().int().min(0).max(200_000).nullable(),
    pauses: z.number().int().min(0).max(10_000),
    awayMs: z.number().min(0).max(86_400_000),
    // [lng, lat]; the app downsamples long routes before sending.
    path: z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])).max(2000),
    title: z.string().trim().max(80),
    activity: z.enum(activityKindEnum.enumValues).exclude(['sleep']),
    // Same shape the activity log accepts (provider ids: letters, digits, _ and -).
    exerciseId: z
      .string()
      .max(120)
      .regex(/^[\w-]+$/),
  })
  .partial()
  .strict();

export const startSessionSchema = z.object({
  kind: z.enum(['walk', 'timer']),
  challengeId: z.uuid().optional(),
  date: localDate,
  data: sessionDataSchema.default({}),
});

export const updateSessionSchema = z.object({ data: sessionDataSchema });

export const finishSessionSchema = z.object({
  date: localDate,
  /** In the challenge's unit (minutes, km, steps). Missing or 0 = keep the card, log nothing. */
  amount: z.number().min(0).max(10_000).optional(),
  data: sessionDataSchema.default({}),
});

export const sessionIdParamSchema = z.object({ id: z.uuid() });

export type SessionDataInput = z.infer<typeof sessionDataSchema>;
export type StartSessionInput = z.infer<typeof startSessionSchema>;
export type FinishSessionInput = z.infer<typeof finishSessionSchema>;
