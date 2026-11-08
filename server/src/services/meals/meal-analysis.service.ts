import { z } from 'zod';
import type { Challenge, ChallengeTracking } from '../../db/schema';
import { generateStructured } from '../ai/ai.service';
import type { ImageInput } from '../ai/llm-provider';

const analysisSchema = z.strictObject({
  isFood: z.boolean(),
  /** Short meal name, e.g. "Dal, rice and roti". */
  title: z.string().max(80),
  items: z
    .array(
      z.strictObject({
        name: z.string().min(1).max(60),
        portion: z.string().max(40),
        proteinG: z.number().min(0).max(500),
        carbsG: z.number().min(0).max(500),
        fatG: z.number().min(0).max(500),
      }),
    )
    .max(8),
  /** One line to the user about this meal against their goal, or what to retake if not food. */
  comment: z.string().min(2).max(160),
  /** Challenges this meal genuinely advances, with the amount in the challenge's unit. */
  credits: z.array(z.strictObject({ challengeId: z.string(), amount: z.number() })).max(6),
  /** Item names (exactly as in items) that break the user's diet or allergies, incl. hidden ones. */
  offDiet: z.array(z.string()).max(8),
});

export type MealAnalysis = z.infer<typeof analysisSchema>;

export interface AnalysisContext {
  goal: string;
  diet: string;
  allergies: string[];
  /** What's left today before this meal. */
  remaining: { calories: number; proteinG: number };
  challenges: (Pick<Challenge, 'id' | 'title' | 'target'> & { tracking: ChallengeTracking })[];
  /** The challenge the user started from, if any. */
  startedFrom?: string;
}

const SYSTEM = `You estimate food for an Indian-first nutrition app, from a photo or from the user's own words ("said").
- isFood: false if no food or drink is visible (or mentioned), or the photo is too dark or blurry to tell. Then items and credits are empty and comment says what would work.
- items: each distinct food with a realistic portion as seen or as said (use their amounts, e.g. "2 rotis") (e.g. "1 katori", "2 rotis", "1 cup"). Estimate grams of protein, carbs and fat for that portion; be realistic for home-style Indian cooking with oil or ghee.
- credits: only for the given challenges this meal clearly advances. amount is in the challenge's unit (servings, grams, meals…); for done/not-done challenges use 1. Never credit a challenge the meal does not fit.
- offDiet: names of items that break the user's diet or allergies (veg = no meat, fish or egg; eggetarian = no meat or fish; vegan = no animal products incl. dairy; jain = veg and no onion, garlic or root vegetables). Name each dish plainly, e.g. "Chicken curry", never disguise it. Base credits ONLY on the items that are not offDiet (the user may remove those); if every item is offDiet, credits is empty.
- comment: one warm, specific sentence (max 18 words) about this meal against the user's goal and what's left today. No emojis, no numbers for calories.`;

/** What the meal is read from: a photo, or what the user said (already transcribed). */
export type MealSource = { image: ImageInput } | { text: string };

/** Reads a meal. Throws if no model could answer (the caller turns that into a 502). */
export async function analyzeMeal(source: MealSource, ctx: AnalysisContext): Promise<MealAnalysis> {
  const { data } = await generateStructured(
    analysisSchema,
    {
      system: SYSTEM,
      user: JSON.stringify({
        goal: ctx.goal,
        diet: ctx.diet,
        allergies: ctx.allergies,
        remainingToday: ctx.remaining,
        challenges: ctx.challenges.map((c) => ({
          challengeId: c.id,
          title: c.title,
          target: c.target,
          unit: c.tracking.kind === 'check' ? 'done' : c.tracking.unit,
        })),
        userStartedFromChallenge: ctx.startedFrom ?? null,
        ...('text' in source && { said: source.text }),
      }),
      ...('image' in source && { images: [source.image] }),
    },
    undefined,
    // Words need no vision model, so they go to the fast provider first (~2 s instead of ~6 s).
    { fast: 'text' in source },
  );
  return data;
}

const itemSchema = z.strictObject({
  isFood: z.boolean(),
  name: z.string().max(60),
  portion: z.string().max(40),
  proteinG: z.number().min(0).max(500),
  carbsG: z.number().min(0).max(500),
  fatG: z.number().min(0).max(500),
});

const ITEM_SYSTEM = `You estimate one food the user typed for an Indian-first nutrition app.
- isFood: false if the text is not a food or drink.
- name: the food, short and plain (e.g. "Curd"). portion: the amount they said, or a typical one (e.g. "1 bowl").
- proteinG, carbsG, fatG: realistic grams for that portion, home-style Indian cooking.`;

/** "2 boiled eggs" → one item with macros. Text only, so it's fast (any provider can answer). */
export async function estimateTypedItem(text: string) {
  const { data } = await generateStructured(
    itemSchema,
    { system: ITEM_SYSTEM, user: text },
    undefined,
    { fast: true },
  );
  return data;
}
