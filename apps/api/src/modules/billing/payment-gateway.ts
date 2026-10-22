import type { Offer, OfferId, Plan, SubscriptionState } from "@cvb/domain";

export type CheckoutRequest = {
  offer: Offer;
  customer: { userId: string; email: string; name: string; stripeCustomerId: string | null };
  successUrl: string;
  cancelUrl: string;
};

/** Normalised events a gateway reports; BillingService applies them without knowing the provider. */
export type BillingEvent =
  | {
      kind: "subscription.changed";
      id: string;
      customerRef: string;
      userId: string | null;
      subscriptionRef: string;
      plan: Plan;
      status: SubscriptionState["status"];
      currentPeriodEnd: Date;
      cancelAtPeriodEnd: boolean;
    }
  | {
      kind: "pass.purchased";
      id: string;
      userId: string;
      offer: OfferId;
      paymentRef: string;
      amountCents: number;
      currency: string;
    }
  | { kind: "ignored"; id: string; type: string };

/**
 * Port for a payment provider (Strategy). Stripe today; a Pakistani wallet aggregator
 * (JazzCash / Easypaisa) plugs in as another implementation.
 */
export interface PaymentGateway {
  readonly id: "stripe" | "local";
  readonly available: boolean;
  createCheckout(req: CheckoutRequest): Promise<{ url: string; customerRef?: string }>;
  createPortal(customerRef: string, returnUrl: string): Promise<{ url: string }>;
  parseWebhook(rawBody: Buffer, signature: string | undefined): Promise<BillingEvent>;
}

export const PAYMENT_GATEWAYS = Symbol.for("cvb.api.PaymentGateways");
