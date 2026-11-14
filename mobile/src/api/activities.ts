import { useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from '@/lib/api-client';
import type { ActivityKind, LogActivityResult } from '@/types/burn';
import { exerciseKeys } from './exercises';
import { todayKey } from './today';

interface LogInput {
  /** A kind, or a library exercise (the server uses its own kind and intensity). */
  kind?: Exclude<ActivityKind, 'sleep'>;
  exerciseId?: string;
  /** Exactly one of minutes (we compute kcal) or calories (from a watch). */
  minutes?: number;
  calories?: number;
}

/** Logs an activity (no photo since 1.1); the burn card and exercise ticks refresh. */
export function useLogActivity(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LogInput) =>
      request<LogActivityResult>('/me/activities', { method: 'POST', body: { date, ...input } }),
    onSuccess: (r) => {
      if (!r.verified) return;
      queryClient.invalidateQueries({ queryKey: todayKey(date) });
      // "Done today" ticks on the exercise pages.
      queryClient.invalidateQueries({ queryKey: exerciseKeys.all });
    },
  });
}

export function useDeleteActivity(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request<void>(`/me/activities/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: todayKey(date) });
      queryClient.invalidateQueries({ queryKey: exerciseKeys.all });
    },
  });
}
