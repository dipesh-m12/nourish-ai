import { z } from 'zod';
import { fetchWithTimeout } from '../ai/llm-provider';
import type { Exercise, ExerciseProvider } from './exercise.types';

/**
 * Free Exercise DB (github.com/yuhonas/free-exercise-db): 870+ exercises, public domain
 * (Unlicense). Nothing is stored on our side: the JSON is read once into memory and refreshed
 * daily; images are served straight from the repo.
 */
const DATA_URL =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
const REFRESH_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 15_000;

const rawSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    category: z.string(),
    level: z.enum(['beginner', 'intermediate', 'expert']),
    equipment: z.string().nullable().optional(),
    primaryMuscles: z.array(z.string()),
    secondaryMuscles: z.array(z.string()),
    instructions: z.array(z.string()),
    images: z.array(z.string()),
  }),
);

/** Provider category → our burn kind and MET (Compendium of Physical Activities). */
const BURN: Record<string, Pick<Exercise, 'kind' | 'met'>> = {
  strength: { kind: 'strength', met: 5.0 },
  powerlifting: { kind: 'strength', met: 6.0 },
  strongman: { kind: 'strength', met: 6.0 },
  'olympic weightlifting': { kind: 'strength', met: 6.0 },
  stretching: { kind: 'stretch', met: 2.3 },
  cardio: { kind: 'cardio', met: 7.0 },
  plyometrics: { kind: 'plyometrics', met: 8.0 },
};

export class FreeExerciseDbProvider implements ExerciseProvider {
  readonly name = 'free-exercise-db';
  private cache: Exercise[] | null = null;
  private loadedAt = 0;
  private inflight: Promise<Exercise[]> | null = null;

  async all(): Promise<Exercise[]> {
    const fresh = this.cache && Date.now() - this.loadedAt < REFRESH_MS;
    if (fresh) return this.cache!;
    // One download at a time, however many requests arrive while it runs.
    this.inflight ??= this.load().finally(() => (this.inflight = null));
    try {
      return await this.inflight;
    } catch (err) {
      if (this.cache) return this.cache; // stale beats nothing if the refresh fails
      throw err;
    }
  }

  private async load(): Promise<Exercise[]> {
    const res = await fetchWithTimeout(DATA_URL, {}, TIMEOUT_MS);
    if (!res.ok) throw new Error(`free-exercise-db: HTTP ${res.status}`);
    const raw = rawSchema.parse(await res.json());
    this.cache = raw.map((e) => ({
      id: e.id,
      name: e.name,
      category: e.category,
      level: e.level,
      equipment: e.equipment ?? null,
      primaryMuscles: e.primaryMuscles,
      secondaryMuscles: e.secondaryMuscles,
      instructions: e.instructions,
      images: e.images.map((p) => IMAGE_BASE + p),
      videos: [],
      ...(BURN[e.category] ?? { kind: 'strength', met: 5.0 }),
    }));
    this.loadedAt = Date.now();
    console.log(`[exercises] loaded ${this.cache.length} from free-exercise-db`);
    return this.cache;
  }
}
