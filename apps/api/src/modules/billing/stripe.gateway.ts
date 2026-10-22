import { CURRENCY, offerById, type OfferId, type Plan, type SubscriptionState } from "@cvb/domain";
import { ValidationError } from "@cvb/shared";
import Stripe from "stripe";
import type { BillingEvent, CheckoutRequest, PaymentGateway } from "./payment-gateway.js";

const PLAN_NAMES: Record<Plan, string> = { free: "Free", standard: "Standard", premium: "Premium", executive: "Executive" };

const toStatus = (s: Stripe.Subscription.Status): SubscriptionState["status"] => {
  if (s === "active" || s === "trialing" || s === "past_due" || s === "canceled") return s as SubscriptionState["status"];
  if (s === "unpaid" || s === "incomplete_expired" || s === "paused") return "canceled";
  return "incomplete";
};

/** Stripe Checkout + Billing Portal. Prices come from the domain offers (no dashboard setup needed). */
export class StripeGateway implements PaymentGateway {
  readonly id = "stripe" as const;
  readonly available = true;
  private readonly stripe: Stripe;

  constructor(
    secretKey: string,
    private readonly webhookSecret: string | undefined,
  ) {
    this.stripe = new Stripe(secretKey);
  }

  async createCheckout({ offer, customer, successUrl, cancelUrl }: CheckoutRequest) {
    let customerRef = customer.stripeCustomerId ?? undefined;
    if (!customerRef) {
      const created = await this.stripe.customers.create({
        email: customer.email,
        name: customer.name,
        metadata: { userId: customer.userId },
      });
      customerRef = created.id;
    }
    const metadata = { userId: customer.userId, offer: offer.id, plan: offer.plan };
    const productName =
      offer.kind === "pass" ? `${PLAN_NAMES[offer.plan]} pass — ${offer.days} days` : `CV Builder ${PLAN_NAMES[offer.plan]}`;

    const session = await this.stripe.checkout.sessions.create({
      customer: customerRef,
      mode: offer.kind === "subscription" ? "subscription" : "payment",
      client_reference_id: customer.userId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      metadata,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: CURRENCY,
            unit_amount: offer.priceCents,
            product_data: { name: productName },
            ...(offer.kind === "subscription" ? { recurring: { interval: offer.interval } } : {}),
          },
        },
      ],
      ...(offer.kind === "subscription" ? { subscription_data: { metadata } } : { payment_intent_data: { metadata } }),
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { url: session.url, customerRef };
  }

  async createPortal(customerRef: string, returnUrl: string) {
    const portal = await this.stripe.billingPortal.sessions.create({ customer: customerRef, return_url: returnUrl });
    return { url: portal.url };
  }

  async parseWebhook(rawBody: Buffer, signature: string | undefined): Promise<BillingEvent> {
    if (!this.webhookSecret || !signature) throw new ValidationError("Missing webhook signature");
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch {
      throw new ValidationError("Invalid webhook signature");
    }

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const offer = offerById(sub.metadata["offer"] as OfferId);
        const periodEnd = sub.items.data[0]?.current_period_end ?? Math.floor(Date.now() / 1000);
        return {
          kind: "subscription.changed",
          id: event.id,
          customerRef: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
          userId: sub.metadata["userId"] ?? null,
          subscriptionRef: sub.id,
          plan: offer.plan,
          status: event.type === "customer.subscription.deleted" ? "canceled" : toStatus(sub.status),
          currentPeriodEnd: new Date(periodEnd * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        };
      }
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode !== "payment" || session.payment_status !== "paid") return { kind: "ignored", id: event.id, type: event.type };
        return {
          kind: "pass.purchased",
          id: event.id,
          userId: session.metadata?.["userId"] ?? session.client_reference_id ?? "",
          offer: session.metadata?.["offer"] as OfferId,
          paymentRef: session.id,
          amountCents: session.amount_total ?? 0,
          currency: session.currency ?? CURRENCY,
        };
      }
      default:
        return { kind: "ignored", id: event.id, type: event.type };
    }
  }
}
