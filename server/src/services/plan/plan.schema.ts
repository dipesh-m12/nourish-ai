import { z } from 'zod';

/**
 * Exactly what the AI must return. The same schema is sent to the provider as JSON Schema
 * (so the model is constrained) and used to validate the reply (so we never trust it blindly).
 * Lengths are asked for in the prompt; `max` limits here are a safety net.
 */
export const aiPlanSchema = z.strictObject({
  summary: z.string().min(10).max(400),
  encouragement: z.string().min(5).max(200),
  focusHabits: z
    .array(z.strictObject({ title: z.string().max(60), why: z.string().max(200) }))
    .length(3),
  sampleDay: z
    .array(
      z.strictObject({
        slot: z.enum(['breakfast', 'lunch', 'snack', 'dinner']),
        meal: z.string().max(120),
        kcal: z.number().int().min(50).max(1500),
      }),
    )
    .length(4),
  challenges: z
    .array(
      z.strictObject({
        title: z.string().max(50),
        target: z.string().max(40),
        why: z.string().max(160),
        frequency: z.enum(['daily', 'weekly']),
        category: z.enum(['movement', 'nutrition', 'hydration', 'sleep', 'mindset']),
      }),
    )
    .length(6),
});

export type AiPlan = z.infer<typeof aiPlanSchema>;
