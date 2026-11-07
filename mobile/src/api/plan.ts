import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '@/lib/api-client';
import { AI_TIMEOUT_MS } from '@/lib/api-config';
import { posthog, posthogLogger } from '@/lib/posthog';
import type { Challenge, Plan } from '@/types/plan';

export const planKeys = { plan: ['plan'] as const };

export function usePlan(enabled = true) {
  return useQuery({ queryKey: planKeys.plan, queryFn: () => request<Plan>('/me/plan'), enabled });
}

/** AI-written plan. Takes several seconds, so the UI shows a waiting state with tips. */
export function useGeneratePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => request<Plan>('/me/plan', { method: 'POST', timeoutMs: AI_TIMEOUT_MS }),
    onSuccess: (plan) => {
      queryClient.setQueryData(planKeys.plan, plan);
      posthog?.capture('plan_generated', { challenge_count: plan.challenges.length });
      posthogLogger.info('plan generated', { challenge_count: plan.challenges.length });
    },
  });
}

export function useAcceptChallenges() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (acceptedIds: string[]) =>
      request<Challenge[]>('/me/challenges', { method: 'PUT', body: { acceptedIds } }),
    onSuccess: (challenges) => {
      queryClient.setQueryData<Plan>(planKeys.plan, (plan) =>
        plan ? { ...plan, challenges } : plan,
      );
      posthog?.capture('challenges_accepted', { challenge_count: challenges.length });
    },
  });
}
