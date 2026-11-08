import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { request } from '@/lib/api-client';
import { AI_TIMEOUT_MS } from '@/lib/api-config';
import type { Briefing } from '@/types/briefing';

/**
 * The dashboard's top card. Keyed on when today's data last changed, so logging anything
 * refreshes the advice; the previous card stays up while the new one loads.
 */
export function useBriefing(date: string, todayVersion: number) {
  return useQuery({
    queryKey: ['briefing', date, todayVersion],
    queryFn: () =>
      request<Briefing>(`/me/briefing?date=${date}&tz=${-new Date().getTimezoneOffset()}`, {
        timeoutMs: AI_TIMEOUT_MS,
      }),
    placeholderData: keepPreviousData,
    enabled: todayVersion > 0,
  });
}
