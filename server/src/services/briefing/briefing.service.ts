import { z } from 'zod';
import { generateStructured } from '../ai/ai.service';
import { buildContext, localClock } from '../agent/agent.context';
import { levelUpFor } from '../challenges/level';
import { signalsService } from '../priorities/signals.service';
import { db } from '../../db';
import { profiles } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { addDays } from '../../utils/dates';
import { buildBriefing, type BriefingInput } from './briefing.rules';

/**
 * The daily briefing. Rules own the advice: they pick the one thing that matters now and say it
 * with exact numbers (an AI rewrite once turned "99 g short, add dal" into "dal will cover it",
 * which is false). The AI only writes the personal "why" line, where warmth matters and there
 * are no facts to bend. Rule text is always the fallback, so the card never waits long.
 */

const whySchema = z.strictObject({ why: z.string().min(4).max(160) });

const WHY_SYSTEM = `You write one short line for a health app's daily briefing card.
Given today's advice, the user's own reason for their goal, and what they've said they care about lately (caresAbout), write ONE sentence (max 18 words, second person) that connects the advice to what they care about most, warmly, e.g. "Every bit of protein keeps you strong enough to keep up with your daughter." Describe benefits as feelings ("more energy on the stairs"), never as lab values.
Rules: no numbers, no medical claims, no promises of results, no emojis, no quotes. Same language as the input.`;

const REWRITE_TIMEOUT_MS = 6000;
/** Goals whose outcome is the scale: the PA asks for a weekly weigh-in. */
const WEIGHT_GOALS = new Set(['lose_weight', 'gain_muscle']);
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 500;

/** Lines keyed by the advice + reason they were written for: same state → no new AI call. */
const cache = new Map<string, { at: number; why: string }>();

const hasDigits = (text: string) => /\d/.test(text);
const sentence = (t: string) => {
  const s = t.trim().replace(/^["“]|["”]$/g, '');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

async function personalWhy(
  advice: string,
  kind: string,
  userWhy: string,
  caresAbout: string[],
  key: string,
) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.why;

  const call = generateStructured(
    whySchema,
    {
      system: WHY_SYSTEM,
      user: JSON.stringify({ advice, kind, theirReason: userWhy, caresAbout }),
    },
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
  /** The card for the dashboard: rules + the AI's personal "why" line. */
  async forDay(profileId: string, date: string, tz: number) {
    const { rules, input, focuses } = await this.rulesFor(profileId, date, tz);
    // An offer carries its own why (in the row); no extra AI line on top of it.
    const why = rules.suggestion
      ? null
      : await personalWhy(
          rules.headline,
          rules.kind,
          input.why,
          focuses,
          // Same advice + same priorities = same line (no new AI call).
          `${profileId}:${rules.kind}:${rules.headline}:${focuses.join('|')}:${input.why}`,
        );

    return {
      kind: rules.kind,
      greeting: rules.greeting,
      headline: rules.headline,
      why: why ?? rules.why,
      week: rules.week,
      actions: rules.actions,
      suggestion: rules.suggestion,
      /** "ai" when the personal line was written by the model; "rules" when the fallback stood. */
      voice: why ? ('ai' as const) : ('rules' as const),
    };
  },

  /** Rules only, no AI call: what push nudges use (cheap enough to run for every user). */
  async rulesFor(profileId: string, date: string, tz: number) {
    const [ctx, weighIns, profile] = await Promise.all([
      buildContext(profileId, date, tz),
      signalsService.weighIns(profileId, 1),
      db.query.profiles.findFirst({
        where: eq(profiles.id, profileId),
        columns: { onboardedAt: true },
      }),
    ]);
    const today = ctx.raw;
    // A weight goal: ask for the weight a week after the last weigh-in (or after they started).
    const lastWeighed = weighIns[0]?.at ?? profile?.onboardedAt ?? null;
    const localDay = (at: Date) => new Date(at.getTime() + tz * 60_000).toISOString().slice(0, 10);
    const weighInDue =
      WEIGHT_GOALS.has(ctx.prompt.goal.type) &&
      lastWeighed !== null &&
      localDay(lastWeighed) <= addDays(date, -7);

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
      findings: ctx.priorities.findings,
      foods: today.meals.flatMap((m) => [m.title, ...m.items.map((it) => it.name)]),
      weighInDue,
      suggestions: ctx.prompt.planChallenges
        .filter((c) => !c.accepted)
        .map(({ id, title, category, target, why }) => ({ id, title, category, target, why })),
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
        levelUp: levelUpFor(c, c.progress.streak, date),
      })),
    };

    return { rules: buildBriefing(input), input, focuses: ctx.priorities.focuses };
  },
};
