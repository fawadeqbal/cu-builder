import type { OfferId, Plan, SubscriptionState } from "@cvb/domain";

export type SubscriptionRecord = SubscriptionState & { providerRef: string; cancelAtPeriodEnd: boolean };
export type PassRecord = { plan: Plan; startsAt: Date; endsAt: Date };

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
  upsertSubscription(input: {
    userId: string;
    providerRef: string;
    plan: Plan;
    status: SubscriptionState["status"];
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
  }): Promise<void>;
  addPass(input: { userId: string; plan: Plan; startsAt: Date; endsAt: Date; providerRef: string; offer: OfferId }): Promise<void>;
  /** Records a provider event id; returns false if it was already processed. */
  markEventProcessed(id: string, type: string): Promise<boolean>;
}

export const BILLING_REPOSITORY = Symbol.for("cvb.api.BillingRepository");
