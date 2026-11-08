import type { ActivityKind } from '../../db/schema';

/** One exercise, provider-neutral. Images are absolute URLs the app can load directly. */
export interface Exercise {
  id: string;
  name: string;
  /** Provider's category, e.g. "strength", "stretching", "cardio". */
  category: string;
  level: 'beginner' | 'intermediate' | 'expert';
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  images: string[];
  /** Demo videos, when the provider has them (MuscleWiki does; Free Exercise DB doesn't). */
  videos: string[];
  /** How a logged session is burned: our activity kind and its MET. */
  kind: Exclude<ActivityKind, 'sleep'>;
  met: number;
}

export interface ExerciseQuery {
  q?: string;
  category?: string;
  muscle?: string;
  level?: Exercise['level'];
  limit: number;
  offset: number;
}

/**
 * Where exercises come from. Free Exercise DB today; a MuscleWiki adapter can implement the
 * same contract once a paid key is set, with nothing else changing.
 */
export interface ExerciseProvider {
  readonly name: string;
  all(): Promise<Exercise[]>;
}
