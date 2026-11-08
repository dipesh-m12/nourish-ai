import { useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from '@/lib/api-client';
import { AI_TIMEOUT_MS } from '@/lib/api-config';
import type { Photo } from '@/lib/photo';
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
  photo: Photo;
}

/** An activity counts once the AI accepts the photo; then the burn card refreshes. */
export function useLogActivity(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ photo, ...input }: LogInput) =>
      request<LogActivityResult>('/me/activities', {
        method: 'POST',
        body: { date, ...input, image: photo },
        timeoutMs: AI_TIMEOUT_MS,
      }),
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
