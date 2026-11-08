import { z } from 'zod';
import type { Challenge, ChallengeTracking } from '../../db/schema';
import { generateStructured } from '../ai/ai.service';
import type { ImageInput } from '../ai/llm-provider';

const verdictSchema = z.strictObject({
  verified: z.boolean(),
  confidence: z.number().min(0).max(1),
  /** Shown to the user. */
  note: z.string().min(2).max(140),
});

export type ProofVerdict = z.infer<typeof verdictSchema>;

/** Below this, a "yes" from the model is treated as not verified. */
const MIN_CONFIDENCE = 0.5;

const SYSTEM = `You check photo proof for a health habit app. The user says they just made progress on a challenge and sent a photo.
Decide if the photo plausibly shows that progress. Be fair, not strict: everyday photos count (a water bottle for hydration, a plate of food for nutrition, shoes, a park or a fitness tracker screen for walking, a bed, pillow, dark bedroom, alarm or sleep-tracker screen for sleep).
If a claimed amount is given, it may cover the whole day (e.g. 1 L of water); accept a related photo without needing the full amount visible.
Reject photos that are clearly unrelated, blank, black, or too blurry to see anything.
note: one short, friendly sentence to the user (max 15 words). If rejected, say what would work instead. No emojis.`;

/** Asks a vision model whether the photo supports the challenge. Throws if no model could check. */
export async function verifyProof(
  challenge: Pick<Challenge, 'title' | 'target' | 'frequency'>,
  tracking: ChallengeTracking,
  image: ImageInput,
  /** The amount the user says this photo covers, in the challenge's unit. */
  amount?: number,
): Promise<ProofVerdict> {
  const { data } = await generateStructured(verdictSchema, {
    system: SYSTEM,
    user: JSON.stringify({
      challenge: challenge.title,
      goal: `${challenge.target} ${challenge.frequency}`,
      expectedProof: tracking.proof,
      claimed: amount && tracking.unit ? `${amount} ${tracking.unit}` : undefined,
    }),
    images: [image],
  });
  return { ...data, verified: data.verified && data.confidence >= MIN_CONFIDENCE };
}
