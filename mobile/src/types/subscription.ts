// Mirrors server/src/services/billing/billing.service.ts → summary().

export interface SubscriptionInfo {
  id: string;
  status: string;
  /** Scheduled first charge (an "upcoming" subscription starts here). */
  startAt: string | null;
  /** Paid through: access ends here unless the next charge succeeds. */
  nextBillAt: string | null;
  endsAt: string | null;
  autoRenew: boolean;
  cancelledAt: string | null;
}

export interface SubscriptionSummary {
  configured: boolean;
  plan: { name: string; amountPaise: number; period: string };
  premium: boolean;
  current: SubscriptionInfo | null;
  upcoming: SubscriptionInfo | null;
}

/** What the checkout WebView page posts back. */
export type CheckoutMessage =
  | { type: 'success'; paymentId: string; subscriptionId: string; signature: string }
  | { type: 'failed'; reason: string }
  | { type: 'dismissed' };
