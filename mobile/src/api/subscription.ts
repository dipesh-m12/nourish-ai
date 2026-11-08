import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

/** Stores a fresh summary and refreshes what membership changes (chat limit, Club tags). */
function applySummary(queryClient: QueryClient, summary: SubscriptionSummary) {
  queryClient.setQueryData(subscriptionKey, summary);
  queryClient.invalidateQueries({ queryKey: ['agent'] });
  queryClient.invalidateQueries({ queryKey: queryKeys.me });
  queryClient.invalidateQueries({ queryKey: queryKeys.profiles });
}

/** Checkout success → the server checks Razorpay's signature and reads the subscription back. */
export function useVerifyPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { paymentId: string; subscriptionId: string; signature: string }) =>
      request<SubscriptionSummary>('/me/subscription/verify', { method: 'POST', body: input }),
    onSuccess: (summary) => applySummary(queryClient, summary),
  });
}

/**
 * Asks the server whether the new subscription is live. Webhooks can confirm a payment the
 * WebView never reported (e.g. a UPI app took over), so this is checked before saying "failed".
 * Live = paid up with autopay on, or a paid-for subscription queued to start later.
 */
export function useCheckMembership() {
  const queryClient = useQueryClient();
  return async () => {
    const summary = await request<SubscriptionSummary>('/me/subscription').catch(() => null);
    if (!summary) return false;
    const live = summary.premium && (!!summary.upcoming || !!summary.current?.autoRenew);
    if (live) applySummary(queryClient, summary);
    return live;
  };
}

/**
 * Checkout closed without paying: the server frees this user's checkout and cancels the unpaid
 * subscription (it asks Razorpay first, so a real payment is never cancelled). Fire-and-forget:
 * if it fails, the checkout simply expires in 15 minutes.
 */
export function abandonCheckout() {
  return request<{ cancelled: boolean }>('/me/subscription/checkout/abandon', {
    method: 'POST',
    body: {},
  }).catch(() => null);
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
