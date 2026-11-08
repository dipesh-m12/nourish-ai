import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { request } from '@/lib/api-client';
import type { Exercise, ExerciseFilters, ExercisePage, ForYou } from '@/types/exercise';

const PAGE = 20;

export const exerciseKeys = {
  all: ['exercises'] as const,
  list: (date: string, q: string, category: string | null) =>
    ['exercises', 'list', date, q, category] as const,
  forYou: (date: string) => ['exercises', 'for-you', date] as const,
  detail: (date: string, id: string) => ['exercises', 'detail', date, id] as const,
};

/** Paged library search; the previous results stay on screen while a new query loads. */
export function useExercises(date: string, q: string, category: string | null) {
  return useInfiniteQuery({
    queryKey: exerciseKeys.list(date, q, category),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ date, limit: String(PAGE), offset: String(pageParam) });
      if (q) params.set('q', q);
      if (category) params.set('category', category);
      return request<ExercisePage>(`/me/exercises?${params}`);
    },
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    placeholderData: keepPreviousData,
  });
}

/** Three picks for today, shaped by the user's goal and level. */
export function useForYou(date: string) {
  return useQuery({
    queryKey: exerciseKeys.forYou(date),
    queryFn: () => request<ForYou>(`/me/exercises/for-you?date=${date}`),
  });
}

/** Categories for the filter chips. Changes rarely, so it's kept for the session. */
export function useExerciseFilters() {
  return useQuery({
    queryKey: ['exercises', 'filters'],
    queryFn: () => request<ExerciseFilters>('/me/exercises/filters'),
    staleTime: Infinity,
  });
}

export function useExercise(date: string, id: string) {
  return useQuery({
    queryKey: exerciseKeys.detail(date, id),
    queryFn: () => request<Exercise>(`/me/exercises/${encodeURIComponent(id)}?date=${date}`),
  });
}
