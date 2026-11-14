import { useQuery } from '@tanstack/react-query';
import { request } from '@/lib/api-client';
import type { WeekReview } from '@/types/week';

const tz = () => -new Date().getTimezoneOffset();

/** The weekly check-in: this week vs last (numbers computed on the server). */
export function useWeek(date: string) {
  return useQuery({
    queryKey: ['week', date],
    queryFn: () => request<WeekReview>(`/me/week?date=${date}&tz=${tz()}`),
  });
}
