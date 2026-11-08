import { z } from 'zod';
import { activityKindEnum } from '../db/schema';
import { localDate } from './challenge.validator';
import { imageInputSchema } from './image.validator';

/** Sleep is logged through the sleep challenge, so it's not a manual option here. */
const loggableKinds = activityKindEnum.enumValues.filter((k) => k !== 'sleep') as [
  Exclude<(typeof activityKindEnum.enumValues)[number], 'sleep'>,
  ...Exclude<(typeof activityKindEnum.enumValues)[number], 'sleep'>[],
];

/** Either minutes (we compute kcal) or kcal straight from a watch — exactly one. */
export const logActivitySchema = z
  .object({
    date: localDate,
    /** Either a kind, or an exercise from the library (its own kind and MET are used). */
    kind: z.enum(loggableKinds).optional(),
    exerciseId: z
      .string()
      .max(120)
      .regex(/^[\w-]+$/)
      .optional(),
    minutes: z.number().int().min(1).max(600).optional(),
    calories: z.number().int().min(1).max(3000).optional(),
    image: imageInputSchema,
  })
  .refine((v) => (v.minutes === undefined) !== (v.calories === undefined), {
    message: 'Send minutes or calories, not both',
  })
  .refine((v) => Boolean(v.kind) !== Boolean(v.exerciseId), {
    message: 'Send a kind or an exerciseId',
  });

export const activityIdParamSchema = z.object({ id: z.uuid() });

export type LogActivityInput = z.infer<typeof logActivitySchema>;
