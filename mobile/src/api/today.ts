import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '@/lib/api-client';
import { AI_TIMEOUT_MS } from '@/lib/api-config';
import type { Photo } from '@/lib/photo';
import type { LogResult, Today } from '@/types/today';

export const todayKey = (date: string) => ['today', date] as const;

/** Dashboard data for the user's local `date`. First load may take a few seconds (AI sets up tracking). */
export function useToday(date: string) {
  return useQuery({
    queryKey: todayKey(date),
    // tz lets the server place "accepted at" timestamps on the user's own calendar.
    queryFn: () =>
      request<Today>(`/me/today?date=${date}&tz=${-new Date().getTimezoneOffset()}`, {
        timeoutMs: AI_TIMEOUT_MS,
      }),
  });
}

/** One tap of progress. A photo only for food challenges (the plate is saved as a meal). */
export function useLogProgress(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      challengeId,
      photo,
      amount,
      source,
    }: {
      challengeId: string;
      photo?: Photo;
      amount?: number;
      /** How it was done (stored for history): a breathing session, a tracked walk. */
      source?: 'timer' | 'walk' | 'place';
    }) =>
      request<LogResult>(`/me/challenges/${challengeId}/logs`, {
        method: 'POST',
        body: { date, image: photo, amount, source },
        // Only a photo goes through the AI; a plain log is instant.
        ...(photo && { timeoutMs: AI_TIMEOUT_MS }),
      }),
    onSuccess: (result) => {
      if (result.verified) queryClient.invalidateQueries({ queryKey: todayKey(date) });
    },
  });
}
