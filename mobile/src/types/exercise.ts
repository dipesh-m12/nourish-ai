// Mirrors server/src/services/exercises/exercise.service.ts.
import type { ActivityKind } from './burn';

export type ExerciseLevel = 'beginner' | 'intermediate' | 'expert';

export interface ExerciseSummary {
  id: string;
  name: string;
  category: string;
  level: ExerciseLevel;
  equipment: string | null;
  primaryMuscles: string[];
  image: string | null;
  doneToday: boolean;
}

export interface Exercise extends Omit<ExerciseSummary, 'image'> {
  secondaryMuscles: string[];
  instructions: string[];
  images: string[];
  videos: string[];
  kind: Exclude<ActivityKind, 'sleep'>;
  met: number;
}

export interface ExercisePage {
  items: ExerciseSummary[];
  total: number;
  nextOffset: number | null;
}

export interface ExerciseFilters {
  categories: { value: string; count: number }[];
  muscles: { value: string; count: number }[];
}

export interface ForYou {
  items: ExerciseSummary[];
  done: number;
}
