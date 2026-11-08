import { randomUUID } from 'node:crypto';
import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import {
  challengeLogs,
  challenges,
  goals,
  meals,
  profiles,
  type Meal,
  type MealItem,
} from '../../db/schema';
import { AppError } from '../../utils/app-error';
import { ensureTracking, shortLabel } from '../challenges/tracking.service';
import { storageService } from '../storage.service';
import type {
  AnalyzeMealInput,
  SaveMealInput,
  VoiceMealInput,
} from '../../validators/meal.validator';
import { conflictMessage, dietConflicts } from '../diet-rules';
import { canCreditFromMeal } from './food-challenge';
import { transcribe } from '../ai/transcription.service';
import { analyzeMeal, estimateTypedItem, type MealSource } from './meal-analysis.service';

const round = (n: number) => Math.round(n);

/** Calories always come from macros (4/4/9), never from the model or the client. */
function kcalOf(m: { proteinG: number; carbsG: number; fatG: number }) {
  return round(m.proteinG * 4 + m.carbsG * 4 + m.fatG * 9);
}

function toItems(raw: SaveMealInput['items']): MealItem[] {
  return raw.map((i) => {
    const macros = { proteinG: round(i.proteinG), carbsG: round(i.carbsG), fatG: round(i.fatG) };
    return { name: i.name, portion: i.portion, ...macros, calories: kcalOf(macros) };
  });
}

function totalsOf(items: MealItem[]) {
  const sum = (k: keyof Omit<MealItem, 'name' | 'portion'>) => items.reduce((s, i) => s + i[k], 0);
  return {
    calories: sum('calories'),
    proteinG: sum('proteinG'),
    carbsG: sum('carbsG'),
    fatG: sum('fatG'),
  };
}

/** Accepted challenges a meal may credit, with tracking specs. */
async function mealChallenges(profileId: string) {
  const rows = await db
    .select()
    .from(challenges)
    .where(and(eq(challenges.profileId, profileId), eq(challenges.accepted, true)))
    .orderBy(asc(challenges.createdAt), asc(challenges.id));
  return ensureTracking(rows.filter(canCreditFromMeal));
}

type Tracked = Awaited<ReturnType<typeof mealChallenges>>[number];

function isProteinGrams(c: Tracked) {
  return /^g(rams?)?$/i.test(c.tracking.unit ?? '') && /protein/i.test(c.title);
}

/**
 * Keeps only credits for the user's own eligible challenges, one per challenge, with the
 * amount capped to one period's target (a meal can finish a challenge, not overflow it).
 */
function cleanCredits(
  credits: { challengeId: string; amount: number }[],
  eligible: Tracked[],
  totals: ReturnType<typeof totalsOf>,
) {
  const byId = new Map(eligible.map((c) => [c.id, c]));
  const seen = new Set<string>();
  return credits.flatMap((cr) => {
    const c = byId.get(cr.challengeId);
    if (!c || seen.has(c.id) || !(cr.amount > 0)) return [];
    seen.add(c.id);
    const t = c.tracking;
    // A protein challenge counted in grams gets the meal's computed protein, not a guess.
    const raw = isProteinGrams(c) ? totals.proteinG : cr.amount;
    const amount = t.kind === 'check' ? 1 : Math.round(Math.min(raw, t.target) * 100) / 100;
    return [
      {
        challengeId: c.id,
        amount,
        label: t.label ?? shortLabel(c.title),
        unit: t.kind === 'check' ? null : t.unit,
      },
    ];
  });
}

async function withPhotoUrl(m: Meal) {
  return {
    id: m.id,
    title: m.title,
    items: m.items,
    calories: m.calories,
    proteinG: m.proteinG,
    carbsG: m.carbsG,
    fatG: m.fatG,
    comment: m.comment,
    createdAt: m.createdAt,
    photoKey: m.photoKey,
    photoUrl: m.photoKey ? await storageService.signedReadUrl(m.photoKey) : null,
  };
}

/**
 * Whisper "hears" stock phrases in silence or noise ("you", "thank you", "thanks for watching").
 * Treat those, and anything with almost no letters, as nothing said.
 */
const WHISPER_SILENCE =
  /^(you|thank you|thanks|thanks for watching|bye|okay|ok|hmm+|uh+|um+)[.!?\s]*$/i;
function isSilence(transcript: string) {
  const t = transcript.trim();
  return t.replace(/[^\p{L}]/gu, '').length < 4 || WHISPER_SILENCE.test(t);
}

export type MealResponse = Awaited<ReturnType<typeof withPhotoUrl>>;

async function analyzeSource(
  profileId: string,
  date: string,
  challengeId: string | undefined,
  source: MealSource,
) {
  const [profile, goal, eligible, eatenRow] = await Promise.all([
    db.query.profiles.findFirst({ where: eq(profiles.id, profileId) }),
    db.query.goals.findFirst({ where: eq(goals.profileId, profileId) }),
    mealChallenges(profileId),
    db
      .select({
        calories: sql<number>`coalesce(sum(${meals.calories}), 0)::int`,
        proteinG: sql<number>`coalesce(sum(${meals.proteinG}), 0)::int`,
      })
      .from(meals)
      .where(and(eq(meals.profileId, profileId), eq(meals.localDate, date))),
  ]);
  if (!goal) throw new AppError(409, 'Finish onboarding before logging meals');
  const eaten = eatenRow[0] ?? { calories: 0, proteinG: 0 };

  let analysis;
  try {
    analysis = await analyzeMeal(source, {
      goal: goal.type,
      diet: profile?.dietType ?? 'unknown',
      allergies: profile?.allergies ?? [],
      remaining: {
        calories: goal.dailyCalories - eaten.calories,
        proteinG: goal.proteinG - eaten.proteinG,
      },
      challenges: eligible,
      startedFrom: eligible.find((c) => c.id === challengeId)?.title,
    });
  } catch {
    throw new AppError(
      502,
      'image' in source
        ? 'We couldn’t read your photo right now. Please try again.'
        : 'We couldn’t work that out right now. Please try again.',
    );
  }

  if (!analysis.isFood || !analysis.items.length) {
    return { isFood: false as const, comment: analysis.comment };
  }
  const items = toItems(analysis.items);
  const conflicts = dietConflicts(
    items.map((i) => i.name),
    profile?.dietType ?? null,
    profile?.allergies ?? [],
    analysis.offDiet,
  );
  return {
    isFood: true as const,
    /** Set while something breaks the diet: calories still count, challenges don't. */
    dietWarning: conflictMessage(conflicts),
    /** Per item, so the app can lift the warning (and restore credits) once it's removed. */
    conflicts: conflicts.map((c) => ({ item: c.item, message: conflictMessage([c])! })),
    title:
      analysis.title ||
      items
        .map((i) => i.name)
        .join(', ')
        .slice(0, 80),
    items,
    totals: totalsOf(items),
    comment: analysis.comment,
    // What the meal earns without its conflicting items; save() re-checks the final list.
    credits: cleanCredits(analysis.credits, eligible, totalsOf(items)),
  };
}

export const mealService = {
  /** The day's meals (oldest first) and their summed totals. */
  async forDay(profileId: string, date: string) {
    const rows = await db
      .select()
      .from(meals)
      .where(and(eq(meals.profileId, profileId), eq(meals.localDate, date)))
      .orderBy(asc(meals.createdAt));
    return {
      meals: await Promise.all(rows.map(withPhotoUrl)),
      eaten: {
        calories: rows.reduce((s, m) => s + m.calories, 0),
        proteinG: rows.reduce((s, m) => s + m.proteinG, 0),
        carbsG: rows.reduce((s, m) => s + m.carbsG, 0),
        fatG: rows.reduce((s, m) => s + m.fatG, 0),
      },
    };
  },

  /** Photo → estimated items, kcal and challenge credits. Saves nothing: the user confirms first. */
  /** Photo → estimate (nothing saved; the user confirms first). */
  analyze(profileId: string, { date, image, challengeId }: AnalyzeMealInput) {
    return analyzeSource(profileId, date, challengeId, { image });
  },

  /**
   * Voice → transcript → the same estimate a photo gets. The transcript comes back too, so the
   * user sees what we heard (and fixes it by editing items).
   */
  async analyzeVoice(profileId: string, { date, audio, challengeId }: VoiceMealInput) {
    let transcript: string;
    try {
      transcript = await transcribe(audio);
    } catch {
      throw new AppError(502, 'We couldn’t hear that right now. Please try again, or type it.');
    }
    if (isSilence(transcript)) {
      return {
        isFood: false as const,
        transcript,
        comment: 'We didn’t catch that. Hold the button and say what you ate.',
      };
    }
    const result = await analyzeSource(profileId, date, challengeId, { text: transcript });
    if (!result.isFood) {
      // The model's own wording talks about photos; for voice, say what to try instead.
      return {
        ...result,
        transcript,
        comment: 'We didn’t hear a food. Try “2 rotis, dal and curd”.',
      };
    }
    return { ...result, transcript };
  },

  /** Stores a confirmed meal and its challenge credits together, so rings never disagree. */
  async save(profileId: string, input: SaveMealInput, photo?: { bytes: Buffer; mimeType: string }) {
    const items = toItems(input.items);
    const [profile, eligible] = await Promise.all([
      db.query.profiles.findFirst({ where: eq(profiles.id, profileId) }),
      mealChallenges(profileId),
    ]);
    // Re-checked here too: the client can't earn challenge credit for food outside the diet.
    const offDiet = dietConflicts(
      items.map((i) => i.name),
      profile?.dietType ?? null,
      profile?.allergies ?? [],
    ).length;
    const credits = offDiet ? [] : cleanCredits(input.credits, eligible, totalsOf(items));

    let photoKey: string | null = null;
    if (photo) {
      const ext =
        photo.mimeType === 'image/png' ? 'png' : photo.mimeType === 'image/webp' ? 'webp' : 'jpg';
      photoKey = `meals/${profileId}/${randomUUID()}.${ext}`;
      await storageService.put(photoKey, photo.bytes, photo.mimeType);
    }

    try {
      const meal = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(meals)
          .values({
            profileId,
            localDate: input.date,
            title: input.title,
            items,
            ...totalsOf(items),
            comment: input.comment ?? null,
            photoKey,
          })
          .returning();
        if (credits.length) {
          await tx.insert(challengeLogs).values(
            credits.map((c) => ({
              challengeId: c.challengeId,
              profileId,
              localDate: input.date,
              amount: c.amount,
              proofNote: `Meal: ${input.title}`,
              mealId: row!.id,
            })),
          );
        }
        return row!;
      });
      return { meal: await withPhotoUrl(meal), credits };
    } catch (err) {
      if (photoKey) await storageService.remove(photoKey); // don't leave an orphaned photo
      throw err;
    }
  },

  /** A food the photo missed, typed by the user. Returns one item (calories from macros). */
  async estimateItem(profileId: string, text: string) {
    const profile = await db.query.profiles.findFirst({ where: eq(profiles.id, profileId) });
    let est;
    try {
      est = await estimateTypedItem(text);
    } catch {
      throw new AppError(502, 'We couldn’t estimate that right now. Please try again.');
    }
    if (!est.isFood || !est.name) return { isFood: false as const };
    const [item] = toItems([est]);
    const conflicts = dietConflicts(
      [item!.name],
      profile?.dietType ?? null,
      profile?.allergies ?? [],
    );
    return { isFood: true as const, item: item!, dietWarning: conflictMessage(conflicts) };
  },

  /** Deletes a meal; its challenge credits go with it (FK cascade), and so does the photo. */
  async remove(profileId: string, id: string) {
    const [row] = await db
      .delete(meals)
      .where(and(eq(meals.id, id), eq(meals.profileId, profileId)))
      .returning({ photoKey: meals.photoKey });
    if (!row) throw AppError.notFound('Meal');
    if (row.photoKey) await storageService.remove(row.photoKey);
  },
};
