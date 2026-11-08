import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { challenges, type Challenge, type ChallengeTracking } from '../../db/schema';
import { generateStructured } from '../ai/ai.service';

/**
 * Turns a free-text challenge ("Drink enough water · 2.5 L · daily") into a tracking spec:
 * what to count, the target, how much one tap adds, which widget shows it, and what photo
 * counts as proof. AI decides once (on first dashboard load); the result is stored on the row.
 */

const trackingSchema = z.strictObject({
  kind: z.enum(['amount', 'check']),
  unit: z.string().max(12).nullable(),
  target: z.number().positive().max(100_000),
  step: z.number().positive().max(10_000),
  widget: z.enum(['ring', 'bars', 'tally', 'check']),
  proof: z.string().min(3).max(120),
  label: z.string().min(2).max(16),
});

const batchSchema = z.strictObject({
  items: z.array(z.strictObject({ id: z.string(), tracking: trackingSchema })),
});

const SYSTEM = `You set up progress tracking for small health challenges in a habit app.
For each challenge, return a tracking spec:
- kind: "amount" if progress is a quantity that adds up (litres, minutes, km, servings, hours, steps); "check" if it's simply done or not done today.
- unit: short unit label taken from the challenge's own target text ("3 sets" → "sets", "20 reps" → "reps", "2 sessions" → "sessions"), e.g. "L", "min", "km", "h", "steps", "sets", "reps", "times". Use "servings" ONLY for food. null for "check".
- target: the numeric goal per period (per day for daily, per week for weekly). Use the challenge's own target text.
- step: how much ONE tap adds. Pick a natural increment: water 0.25 L, minutes 5 or 10, km 0.5, servings 1, sleep hours = the full target (logged once).
- widget: "ring" for volumes/amounts towards a daily total (water, sleep), "bars" for minutes/distance/steps where a 7-day trend matters, "tally" for small whole counts up to 8 (servings, sessions per week), "check" for done/not done.
- proof: what a photo should show to prove it, in under 12 words (e.g. "a glass or bottle of water", "a meal with vegetables on the plate", "shoes outdoors or a fitness tracker screen").
- label: a 1–2 word card title, Title Case, max 14 characters (e.g. "Water", "Walk", "Protein", "Veggies", "Bedtime", "No sugar").
Keep target/step at most 40. Return every id you were given, unchanged.`;

/** Keyword → short card label, for rule-based specs and older specs saved before labels existed. */
const LABEL_RULES: [RegExp, string][] = [
  [/water|hydrat/, 'Water'],
  [/stroll|walk/, 'Walk'],
  [/run|jog/, 'Run'],
  [/yoga|stretch/, 'Stretch'],
  [/strength|workout|gym/, 'Strength'],
  [/protein/, 'Protein'],
  [/salad|veg|greens/, 'Veggies'],
  [/fruit/, 'Fruit'],
  [/sugar/, 'No sugar'],
  [/meal prep|prep/, 'Meal prep'],
  [/bed|sleep/, 'Sleep'],
  [/screen|phone/, 'Screens off'],
  [/breath|meditat|mindful/, 'Mindful'],
];

export function shortLabel(title: string): string {
  const t = title.toLowerCase();
  const rule = LABEL_RULES.find(([re]) => re.test(t));
  if (rule) return rule[1];
  return title.split(/\s+/).slice(0, 2).join(' ').slice(0, 14);
}

/** Rule-based fallback when AI is unavailable: parse the number and unit from the target text. */
export function heuristicTracking(
  c: Pick<Challenge, 'title' | 'target' | 'category'>,
): ChallengeTracking {
  const text = `${c.target} ${c.title}`.toLowerCase();
  const num = Number(/(\d+(?:\.\d+)?)/.exec(c.target)?.[1] ?? NaN);
  const has = (re: RegExp) => re.test(text);
  const base = { proof: proofFor(c.category), label: shortLabel(c.title) };
  if (!Number.isFinite(num) || num <= 0) {
    return { kind: 'check', unit: null, target: 1, step: 1, widget: 'check', ...base };
  }
  const amount = (
    target: number,
    unit: string | null,
    step: number,
    widget: ChallengeTracking['widget'],
  ) => ({ kind: 'amount', unit, target, step, widget, ...base }) as const;
  if (has(/\b(l|litre|liter)s?\b/)) return amount(num, 'L', 0.25, 'ring');
  if (has(/\bml\b/)) return amount(num / 1000, 'L', 0.25, 'ring');
  if (has(/\b(min|minutes?)\b/)) return amount(num, 'min', num >= 30 ? 10 : 5, 'bars');
  if (has(/\bkm\b/)) return amount(num, 'km', 0.5, 'bars');
  if (has(/\b(h|hours?|hrs?)\b/)) return amount(num, 'h', num, 'ring');
  if (num <= 8) return amount(num, unitFromTarget(c.target) ?? 'times', 1, 'tally');
  return amount(num, null, Math.max(1, Math.round(num / 10)), 'bars');
}

function proofFor(category: string): string {
  switch (category) {
    case 'hydration':
      return 'a glass or bottle of water';
    case 'nutrition':
      return 'the meal or food on your plate';
    case 'movement':
      return 'you outdoors, your shoes, or a fitness tracker screen';
    case 'sleep':
      return 'your bed, alarm, or a sleep tracker screen';
    default:
      return 'something that shows you did it';
  }
}

/** The word after the number in a target ("3 sets" → "sets"), if it reads like a unit. */
function unitFromTarget(target: string): string | null {
  const word = /\d+(?:\.\d+)?\s*([a-z]+)/i.exec(target)?.[1]?.toLowerCase();
  return word && word.length <= 12 && !['per', 'a', 'each', 'every', 'x'].includes(word)
    ? word
    : null;
}

/** "servings" only makes sense for food; models sometimes reuse it for squats or sessions. */
function hasWrongUnit(t: ChallengeTracking, category: Challenge['category']) {
  return t.kind === 'amount' && t.unit === 'servings' && category !== 'nutrition';
}

function fixUnit(t: ChallengeTracking, c: Pick<Challenge, 'target' | 'category'>) {
  return hasWrongUnit(t, c.category) ? { ...t, unit: unitFromTarget(c.target) ?? 'times' } : t;
}

/** Keeps AI specs sane: no 1000-tap goals, widgets that suit the kind, units that fit the category. */
function sanitize(
  t: ChallengeTracking,
  c: Pick<Challenge, 'target' | 'category'>,
): ChallengeTracking {
  if (t.kind === 'check') return { ...t, unit: null, target: 1, step: 1, widget: 'check' };
  const step = Math.min(t.step, t.target);
  const widget = t.widget === 'check' ? 'ring' : t.widget;
  return fixUnit({ ...t, step, widget, target: t.target / step > 40 ? step * 40 : t.target }, c);
}

/** Ensures every given challenge has a stored tracking spec; returns them all with specs. */
export async function ensureTracking(
  items: Challenge[],
): Promise<(Challenge & { tracking: ChallengeTracking })[]> {
  const missing = items.filter((c) => !c.tracking);
  if (missing.length) {
    let specs = new Map<string, ChallengeTracking>();
    try {
      const { data } = await generateStructured(batchSchema, {
        system: SYSTEM,
        user: JSON.stringify(
          missing.map(({ id, title, target, frequency, category }) => ({
            id,
            title,
            target,
            frequency,
            category,
          })),
        ),
      });
      const byId = new Map(missing.map((c) => [c.id, c]));
      specs = new Map(
        data.items.flatMap((i) => {
          const c = byId.get(i.id);
          return c ? [[i.id, sanitize(i.tracking, c)] as const] : [];
        }),
      );
    } catch (err) {
      console.warn(
        '[tracking] AI unavailable, using rules:',
        err instanceof Error ? err.message : err,
      );
    }
    await Promise.all(
      missing.map((c) => {
        const tracking = specs.get(c.id) ?? heuristicTracking(c);
        c.tracking = tracking;
        return db.update(challenges).set({ tracking }).where(eq(challenges.id, c.id));
      }),
    );
  }

  // Repair stored specs with no rules-only AI call: older ones lack a label, some got
  // "servings" on a non-food challenge. Fixed once, then saved.
  const stale = items.filter(
    (c) => c.tracking && (!c.tracking.label || hasWrongUnit(c.tracking, c.category)),
  );
  await Promise.all(
    stale.map((c) => {
      const tracking = {
        ...fixUnit(c.tracking!, c),
        label: c.tracking!.label ?? shortLabel(c.title),
      };
      c.tracking = tracking;
      return db.update(challenges).set({ tracking }).where(eq(challenges.id, c.id));
    }),
  );

  return items as (Challenge & { tracking: ChallengeTracking })[];
}
