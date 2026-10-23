import type { MrrMovement, MrrSubscription, OfferId, Plan, SubscriptionState } from "@cvb/domain";

export type SubscriptionRecord = SubscriptionState & { providerRef: string; cancelAtPeriodEnd: boolean };
export type PassRecord = { plan: Plan; startsAt: Date; endsAt: Date };

/** Money on a processed provider event, for the revenue report. */
export type EventPayment = { amountCents: number; currency: string; userId?: string | null; offer?: string | null };

export type BillingProfile = {
  userId: string;
  email: string;
  name: string;
  basePlan: Plan;
  stripeCustomerId: string | null;
  subscriptions: SubscriptionRecord[];
  passes: PassRecord[];
};

/** Persistence port for plans, subscriptions, passes and processed webhook events. */
export interface BillingRepository {
  profile(userId: string): Promise<BillingProfile | null>;
  setStripeCustomerId(userId: string, customerId: string): Promise<void>;
  userIdForStripeCustomer(customerId: string): Promise<string | null>;
  /** The stored subscription as MRR sees it, or null the first time we hear of it. */
  findSubscription(providerRef: string): Promise<(MrrSubscription & { cancelAtPeriodEnd: boolean; canceledAt: Date | null }) | null>;
  /** Saves the subscription and appends its MRR movements in one transaction. */
  upsertSubscription(
    input: {
      userId: string;
      providerRef: string;
      plan: Plan;
      status: SubscriptionState["status"];
      currentPeriodEnd: Date;
      cancelAtPeriodEnd: boolean;
      currency: string;
      offerId?: OfferId | null;
      amountCents?: number | null;
      interval?: "month" | "year" | null;
      canceledAt?: Date | null;
    },
    movements?: (MrrMovement & { currency: string; at: Date })[],
  ): Promise<void>;
  addPass(input: {
    userId: string;
    plan: Plan;
    startsAt: Date;
    endsAt: Date;
    providerRef: string;
    offer: OfferId;
    amountCents: number;
    currency: string;
  }): Promise<void>;
  /** A purchased AI credit pack (an append-only ledger row). */
  addCredits(input: { userId: string; credits: number; providerRef: string }): Promise<void>;
  /** Records a provider event id (and what it charged, refunded or failed to charge); returns false if it was already processed. */
  markEventProcessed(id: string, type: string, payment?: EventPayment): Promise<boolean>;
}

export const BILLING_REPOSITORY = Symbol.for("cvb.api.BillingRepository");
