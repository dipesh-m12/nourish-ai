import { z } from 'zod';
import { localDate } from './challenge.validator';
import { imageInputSchema } from './image.validator';

export const analyzeMealSchema = z.object({
  date: localDate,
  image: imageInputSchema,
  /** Set when the user started from a challenge's "+", so the AI knows what they meant to log. */
  challengeId: z.uuid().optional(),
});

const grams = z.number().min(0).max(1500);

/** What the user confirmed. Calories are NOT accepted from the client: they're computed from macros. */
export const saveMealSchema = z.object({
  date: localDate,
  title: z.string().trim().min(1).max(80),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        portion: z.string().trim().max(40),
        proteinG: grams,
        carbsG: grams,
        fatG: grams,
      }),
    )
    .min(1, 'Add at least one item')
    .max(12),
  comment: z.string().max(200).optional(),
  /** Challenge credits from the analysis. The server re-checks each one. */
  /** The challenge whose "+" opened the meal sheet; it's credited if the food is on-diet. */
  challengeId: z.uuid().optional(),
  credits: z
    .array(z.object({ challengeId: z.uuid(), amount: z.number().positive().max(1000) }))
    .max(6)
    .default([]),
  image: imageInputSchema.optional(),
});

/** "1 bowl curd" → one estimated item, for foods the photo missed. */
export const estimateItemSchema = z.object({ text: z.string().trim().min(2).max(80) });

export const mealIdParamSchema = z.object({ id: z.uuid() });

export type AnalyzeMealInput = z.infer<typeof analyzeMealSchema>;
export type EstimateItemInput = z.infer<typeof estimateItemSchema>;
export type SaveMealInput = z.infer<typeof saveMealSchema>;
