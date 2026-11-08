import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '../../db';
import { activities, goals, profiles } from '../../db/schema';
import { AppError } from '../../utils/app-error';
import type { Exercise, ExerciseProvider, ExerciseQuery } from './exercise.types';
import { FreeExerciseDbProvider } from './free-exercise-db.provider';

// MuscleWiki needs a paid tier for direct API access; when one is set, a MuscleWiki adapter
// implementing ExerciseProvider slots in here. Until then, the public-domain library.
const provider: ExerciseProvider = new FreeExerciseDbProvider();

/** What each goal leans on, in order. Picks rotate daily within these. */
const GOAL_MIX: Record<string, string[]> = {
  lose_weight: ['cardio', 'strength', 'plyometrics'],
  gain_muscle: ['strength', 'strength', 'stretching'],
  maintain: ['strength', 'cardio', 'stretching'],
  eat_healthier: ['cardio', 'stretching', 'strength'],
};

/** Equipment you can manage at home or in a basic gym (the app is Indian-first, not gym-first). */
const EVERYDAY_EQUIPMENT = new Set([
  null,
  'body only',
  'dumbbell',
  'bands',
  'exercise ball',
  'other',
]);

async function library(): Promise<Exercise[]> {
  try {
    return await provider.all();
  } catch (err) {
    console.warn('[exercises] library unavailable:', err instanceof Error ? err.message : err);
    throw new AppError(503, 'The exercise library is unavailable right now. Please try again.');
  }
}

function summary(e: Exercise, done: Set<string>) {
  return {
    id: e.id,
    name: e.name,
    category: e.category,
    level: e.level,
    equipment: e.equipment,
    primaryMuscles: e.primaryMuscles,
    image: e.images[0] ?? null,
    doneToday: done.has(e.id),
  };
}

async function doneOn(profileId: string, date: string) {
  const rows = await db
    .select({ id: activities.exerciseId })
    .from(activities)
    .where(
      and(
        eq(activities.profileId, profileId),
        eq(activities.localDate, date),
        isNotNull(activities.exerciseId),
      ),
    );
  return new Set(rows.map((r) => r.id!));
}

/** Small stable hash, so "today's picks" stay the same all day and change tomorrow. */
function seed(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

const matches = (e: Exercise, q: string) =>
  e.name.toLowerCase().includes(q) || e.primaryMuscles.some((m) => m.includes(q));

export const exerciseService = {
  async list(profileId: string, date: string, query: ExerciseQuery) {
    const [all, done] = await Promise.all([library(), doneOn(profileId, date)]);
    const q = query.q?.trim().toLowerCase();
    const filtered = all.filter(
      (e) =>
        (!q || matches(e, q)) &&
        (!query.category || e.category === query.category) &&
        (!query.muscle || e.primaryMuscles.includes(query.muscle)) &&
        (!query.level || e.level === query.level),
    );
    const page = filtered.slice(query.offset, query.offset + query.limit);
    const next = query.offset + query.limit;
    return {
      items: page.map((e) => summary(e, done)),
      total: filtered.length,
      nextOffset: next < filtered.length ? next : null,
    };
  },

  async get(profileId: string, date: string, id: string) {
    const [all, done] = await Promise.all([library(), doneOn(profileId, date)]);
    const e = all.find((x) => x.id === id);
    if (!e) throw AppError.notFound('Exercise');
    return { ...e, doneToday: done.has(e.id) };
  },

  /** Categories and muscles with counts, for filter chips. */
  async filters() {
    const all = await library();
    const count = (values: string[]) =>
      [...values.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map<string, number>())]
        .sort((a, b) => b[1] - a[1])
        .map(([value, n]) => ({ value, count: n }));
    return {
      categories: count(all.map((e) => e.category)),
      muscles: count(all.flatMap((e) => e.primaryMuscles)),
    };
  },

  /**
   * Three picks for today, shaped by the goal and fitness level, home-friendly, stable for the
   * day. Done ones stay in the list (ticked), so finishing all three feels like a win.
   */
  async forYou(profileId: string, date: string) {
    const [all, done, profile, goal] = await Promise.all([
      library(),
      doneOn(profileId, date),
      db.query.profiles.findFirst({ where: eq(profiles.id, profileId) }),
      db.query.goals.findFirst({ where: eq(goals.profileId, profileId) }),
    ]);
    const fit = profile?.activityLevel === 'active' || profile?.activityLevel === 'very_active';
    const levels = new Set<Exercise['level']>(fit ? ['beginner', 'intermediate'] : ['beginner']);
    const mix = GOAL_MIX[goal?.type ?? 'maintain'] ?? GOAL_MIX.maintain!;

    const picked: Exercise[] = [];
    mix.forEach((category, slot) => {
      const pool = all.filter(
        (e) =>
          e.category === category &&
          levels.has(e.level) &&
          EVERYDAY_EQUIPMENT.has(e.equipment) &&
          e.images.length > 0 &&
          !picked.includes(e),
      );
      if (pool.length) picked.push(pool[seed(`${profileId}:${date}:${slot}`) % pool.length]!);
    });

    const items = picked.map((e) => summary(e, done));
    return { items, done: items.filter((i) => i.doneToday).length };
  },
};
