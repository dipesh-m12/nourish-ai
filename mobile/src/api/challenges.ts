import { useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from '@/lib/api-client';
import { AI_TIMEOUT_MS } from '@/lib/api-config';
import type { Photo } from '@/lib/photo';
import type { Report } from '@/lib/report';
import { posthog } from '@/lib/posthog';
import type { ChallengeProposal } from '@/types/plan';
import { planKeys } from './plan';

/** Today's dashboard + the picker both change when challenges are added, extended or retired. */
function useRefreshChallenges() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['today'] });
    void queryClient.invalidateQueries({ queryKey: planKeys.plan });
    void queryClient.invalidateQueries({ queryKey: ['briefing'] });
  };
}

export interface ProposeResult {
  reply: string;
  proposals: ChallengeProposal[];
  /** Already at the daily maximum: finish one first. */
  full: boolean;
}

/** "What do you want to achieve?" → AI proposals. Nothing is saved. */
export function useProposeChallenges() {
  return useMutation({
    mutationFn: (body: { date: string; text?: string; image?: Photo | Report }) =>
      request<ProposeResult>('/me/challenges/propose', {
        method: 'POST',
        body,
        timeoutMs: AI_TIMEOUT_MS,
      }),
  });
}

export type NewChallenge = Omit<ChallengeProposal, 'ask'>;

export function useCreateChallenges() {
  const refresh = useRefreshChallenges();
  return useMutation({
    mutationFn: (body: { date: string; items: NewChallenge[] }) =>
      request<{ id: string }[]>('/me/challenges', { method: 'POST', body }),
    onSuccess: (rows) => {
      refresh();
      posthog?.capture('challenges_created', { count: rows.length });
    },
  });
}

/** Keep going: +N days, ongoing (endsOn null) or a custom last day. */
export function useUpdateExpiry() {
  const refresh = useRefreshChallenges();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      date: string;
      extendDays?: number;
      endsOn?: string | null;
    }) => request(`/me/challenges/${id}/expiry`, { method: 'PATCH', body }),
    onSuccess: refresh,
  });
}

/** Goals that follow progress: one step up or down, from tomorrow (the server picks the number). */
export function useSetLevel() {
  const refresh = useRefreshChallenges();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; date: string; direction: 'up' | 'down' }) =>
      request<{ from: number; to: number; unit: string | null; startsOn: string }>(
        `/me/challenges/${id}/level`,
        { method: 'PATCH', body },
      ),
    onSuccess: () => {
      refresh();
      void queryClient.invalidateQueries({ queryKey: ['week'] });
    },
  });
}

/** "From tomorrow: 25 min" */
export const levelToast = (r: { to: number; unit: string | null }) =>
  `From tomorrow: ${r.to}${r.unit ? ` ${r.unit}` : ''}`;

/** Done with a challenge: off the day, history kept. */
export function useFinishChallenge() {
  const refresh = useRefreshChallenges();
  return useMutation({
    mutationFn: (id: string) => request(`/me/challenges/${id}/finish`, { method: 'POST' }),
    onSuccess: refresh,
  });
}

/** A daily reminder push at a local time ("07:30"), or null to stop it. */
export function useSetReminder() {
  const refresh = useRefreshChallenges();
  return useMutation({
    mutationFn: ({ id, remindAt }: { id: string; remindAt: string | null }) =>
      request(`/me/challenges/${id}/reminder`, { method: 'PUT', body: { remindAt } }),
    onSuccess: refresh,
  });
}

export interface ReminderPlan {
  reply: string;
  changes: { id: string; title: string; from: string | null; remindAt: string | null }[];
  /** Water sips on/off; null = leave as is. */
  water: boolean | null;
}

/** "Walk at 7, water every morning" → a plan for the user to confirm. Saves nothing. */
export function useReminderPlan() {
  return useMutation({
    mutationFn: (body: { date: string; text: string }) =>
      request<ReminderPlan>('/me/reminders/plan', {
        method: 'POST',
        body,
        timeoutMs: AI_TIMEOUT_MS,
      }),
  });
}

/** Several reminders in one go (select all → one time, a confirmed plan) + water sips. */
export function useSaveReminders() {
  const refresh = useRefreshChallenges();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { items: { id: string; remindAt: string | null }[]; water?: boolean }) =>
      request('/me/reminders', { method: 'PUT', body }),
    onSuccess: (_r, body) => {
      refresh();
      if (body.water !== undefined) void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

/** Pin (or clear) the place for a "get there" challenge. */
export function useSetPlace() {
  const refresh = useRefreshChallenges();
  return useMutation({
    mutationFn: ({
      id,
      place,
    }: {
      id: string;
      place: { lat: number; lng: number; radiusM: number } | null;
    }) => request(`/me/challenges/${id}/place`, { method: 'PUT', body: { place } }),
    onSuccess: refresh,
  });
}
