import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '@/lib/api-client';
import type { SubscriptionSummary } from '@/types/subscription';
import { queryKeys } from './profiles';

export const subscriptionKey = ['subscription'] as const;

/** Plan, access and the current/upcoming subscription. */
export function useSubscription() {
  return useQuery({
    queryKey: subscriptionKey,
    queryFn: () => request<SubscriptionSummary>('/me/subscription'),
  });
}

/** Starts (or reuses) a Razorpay subscription; the WebView then opens its checkout page. */
export function useStartCheckout() {
  return useMutation({
    mutationFn: () =>
      request<{ subscriptionId: string; keyId: string }>('/me/subscription/checkout', {
        method: 'POST',
        body: {},
      }),
  });
}

/** Checkout success → the server checks Razorpay's signature and reads the subscription back. */
export function useVerifyPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { paymentId: string; subscriptionId: string; signature: string }) =>
      request<SubscriptionSummary>('/me/subscription/verify', { method: 'POST', body: input }),
    onSuccess: (summary) => {
      queryClient.setQueryData(subscriptionKey, summary);
      // The assistant's free-message limit lifts straight away; the Club tag shows on avatars.
      queryClient.invalidateQueries({ queryKey: ['agent'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles });
    },
  });
}

/** Autopay off. No refund: access stays until the paid-through date. */
export function useCancelSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      request<SubscriptionSummary>('/me/subscription/cancel', { method: 'POST', body: {} }),
    onSuccess: (summary) => queryClient.setQueryData(subscriptionKey, summary),
  });
}
