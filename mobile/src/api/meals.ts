import { useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from '@/lib/api-client';
import { AI_TIMEOUT_MS } from '@/lib/api-config';
import type { Photo } from '@/lib/photo';
import type { EstimatedItem, MealAnalysis, MealCredit, MealItem, SavedMeal } from '@/types/meal';
import { todayKey } from './today';

/** Photo → estimated items, kcal and challenge credits. Nothing is saved until the user confirms. */
export function useAnalyzeMeal(date: string) {
  return useMutation({
    mutationFn: ({ photo, challengeId }: { photo: Photo; challengeId?: string }) =>
      request<MealAnalysis>('/me/meals/analyze', {
        method: 'POST',
        body: { date, image: photo, challengeId },
        timeoutMs: AI_TIMEOUT_MS,
      }),
  });
}

interface SaveInput {
  title: string;
  items: MealItem[];
  comment?: string;
  credits: MealCredit[];
  photo?: Photo;
}

/** Saves a confirmed meal. Refreshing `today` moves the calorie ring and any credited challenges together. */
export function useSaveMeal(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ photo, credits, ...meal }: SaveInput) =>
      request<SavedMeal>('/me/meals', {
        method: 'POST',
        body: {
          date,
          ...meal,
          credits: credits.map(({ challengeId, amount }) => ({ challengeId, amount })),
          image: photo,
        },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todayKey(date) }),
  });
}

/** Deleting a meal also removes the challenge progress it gave (server-side cascade). */
export function useDeleteMeal(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request<void>(`/me/meals/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todayKey(date) }),
  });
}

/** "1 bowl curd" → one estimated item, for food the photo missed. */
export function useEstimateItem() {
  return useMutation({
    mutationFn: (text: string) =>
      request<EstimatedItem>('/me/meals/items/estimate', {
        method: 'POST',
        body: { text },
        timeoutMs: AI_TIMEOUT_MS,
      }),
  });
}
