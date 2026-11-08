import { z } from 'zod';
import { generateStructured } from '../ai/ai.service';
import { buildContext, localClock } from '../agent/agent.context';
import { buildBriefing, type BriefingInput } from './briefing.rules';

/**
 * The daily briefing. Rules own the advice: they pick the one thing that matters now and say it
 * with exact numbers (an AI rewrite once turned "99 g short, add dal" into "dal will cover it",
 * which is false). The AI only writes the personal "why" line, where warmth matters and there
 * are no facts to bend. Rule text is always the fallback, so the card never waits long.
 */

const whySchema = z.strictObject({ why: z.string().min(4).max(160) });

const WHY_SYSTEM = `You write one short line for a health app's daily briefing card.
Given today's advice and the user's own reason for their goal, write ONE sentence (max 18 words, second person) that connects the two warmly, e.g. "Every bit of protein keeps you strong enough to keep up with your daughter."
Rules: no numbers, no medical claims, no promises of results, no emojis, no quotes. Same language as the input.`;

const REWRITE_TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 500;

/** Lines keyed by the advice + reason they were written for: same state → no new AI call. */
const cache = new Map<string, { at: number; why: string }>();

const hasDigits = (text: string) => /\d/.test(text);
const sentence = (t: string) => {
  const s = t.trim().replace(/^["“]|["”]$/g, '');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

async function personalWhy(advice: string, kind: string, userWhy: string, key: string) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.why;

  const call = generateStructured(
    whySchema,
    { system: WHY_SYSTEM, user: JSON.stringify({ advice, kind, theirReason: userWhy }) },
    (v) => (hasDigits(v.why) ? 'contains a number' : null),
    { fast: true },
  ).then((r) => sentence(r.data.why));
  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), REWRITE_TIMEOUT_MS),
  );

  try {
    const why = await Promise.race([call, timeout]);
    if (!why) return null;
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
    cache.set(key, { at: Date.now(), why });
    return why;
  } catch {
    return null; // every provider failed: the rule text stands
  }
}

export const briefingService = {
  async forDay(profileId: string, date: string, tz: number) {
    const ctx = await buildContext(profileId, date, tz);
    const today = ctx.raw;

    const input: BriefingInput = {
      name: ctx.name,
      hour: ctx.clock.hour,
      diet: ctx.prompt.user.diet,
      allergies: ctx.prompt.user.allergies,
      why: ctx.prompt.goal.why,
      targets: { calories: today.targets!.calories, proteinG: today.targets!.proteinG },
      eaten: { calories: today.eaten.calories, proteinG: today.eaten.proteinG },
      mealHours: today.meals.map((m) => localClock(tz, new Date(m.createdAt)).hour),
      sleepMinutes: today.burn.sleepMinutes,
      challenges: today.challenges.map((c) => ({
        id: c.id,
        label: c.tracking.label ?? c.title,
        category: c.category,
        frequency: c.frequency,
        unit: c.tracking.kind === 'check' ? null : c.tracking.unit,
        step: c.tracking.step,
        value: c.progress.value,
        goal: c.progress.goal,
        done: c.progress.done,
        streak: c.progress.streak,
        history: c.progress.history,
      })),
    };

    const rules = buildBriefing(input);
    const why = await personalWhy(
      rules.headline,
      rules.kind,
      input.why,
      `${profileId}:${rules.kind}:${input.why}`,
    );

    return {
      kind: rules.kind,
      greeting: rules.greeting,
      headline: rules.headline,
      why: why ?? rules.why,
      week: rules.week,
      actions: rules.actions,
      /** "ai" when the personal line was written by the model; "rules" when the fallback stood. */
      voice: why ? ('ai' as const) : ('rules' as const),
    };
  },
};
