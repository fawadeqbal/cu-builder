import { DEFAULT_CURRENCY, offerById, type OfferId, type Plan, type SubscriptionState } from "@cvb/domain";
import { ValidationError } from "@cvb/shared";
import Stripe from "stripe";
import type { BillingEvent, CheckoutRequest, PaymentGateway } from "./payment-gateway.js";

const PLAN_NAMES: Record<Plan, string> = { free: "Free", standard: "Standard", premium: "Premium", executive: "Executive" };

const toStatus = (s: Stripe.Subscription.Status): SubscriptionState["status"] => {
  if (s === "active" || s === "trialing" || s === "past_due" || s === "canceled") return s as SubscriptionState["status"];
  if (s === "unpaid" || s === "incomplete_expired" || s === "paused") return "canceled";
  return "incomplete";
};

/** Bump when the portal features below change, so a new configuration is created. */
const PORTAL_VERSION = "cvb-portal-1";

/**
 * Stripe Checkout + Billing Portal. Prices come from the domain offers and admin overrides, sent
 * inline per Checkout session in the chosen currency (no dashboard setup needed).
 */
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

  private portalConfig: Promise<string> | null = null;

  async createCheckout({ offer, price, customer, successUrl, cancelUrl }: CheckoutRequest) {
    let customerRef = customer.stripeCustomerId ?? undefined;
    if (!customerRef) {
      const created = await this.stripe.customers.create({
        email: customer.email,
        name: customer.name,
        metadata: { userId: customer.userId },
      });
      customerRef = created.id;
    }
    const metadata = {
      userId: customer.userId,
      offer: offer.id,
      currency: price.currency,
      ...(offer.kind === "credits" ? {} : { plan: offer.plan }),
    };
    const productName =
      offer.kind === "pass"
        ? `${PLAN_NAMES[offer.plan]} pass — ${offer.days} days`
        : offer.kind === "credits"
          ? `${offer.credits} AI credits`
          : `CV Builder ${PLAN_NAMES[offer.plan]}`;

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
            currency: price.currency,
            unit_amount: price.amount,
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
    const configuration = await this.portalConfiguration();
    const portal = await this.stripe.billingPortal.sessions.create({ customer: customerRef, return_url: returnUrl, configuration });
    return { url: portal.url };
  }

  /**
   * Our own portal configuration, so cancelling from the account always works whatever the
   * dashboard defaults are: cancel at period end, update the card, see invoices. Found by
   * metadata, created once.
   */
  private portalConfiguration(): Promise<string> {
    this.portalConfig ??= (async () => {
      const existing = await this.stripe.billingPortal.configurations.list({ active: true, limit: 100 });
      const found = existing.data.find((c) => c.metadata?.["cvb"] === PORTAL_VERSION);
      if (found) return found.id;
      const created = await this.stripe.billingPortal.configurations.create({
        name: "CV Builder",
        metadata: { cvb: PORTAL_VERSION },
        features: {
          subscription_cancel: { enabled: true, mode: "at_period_end", proration_behavior: "none" },
          payment_method_update: { enabled: true },
          invoice_history: { enabled: true },
          customer_update: { enabled: true, allowed_updates: ["email", "name", "address"] },
        },
      });
      return created.id;
    })().catch((e: unknown) => {
      this.portalConfig = null;
      throw e;
    });
    return this.portalConfig;
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
        if (offer.kind !== "subscription") return { kind: "ignored", id: event.id, type: event.type };
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
          currency: sub.currency ?? sub.metadata["currency"] ?? DEFAULT_CURRENCY,
        };
      }
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode !== "payment" || session.payment_status !== "paid") return { kind: "ignored", id: event.id, type: event.type };
        const orderId = session.metadata?.["orderId"];
        if (orderId) {
          const intent = session.payment_intent;
          return {
            kind: "order.paid",
            id: event.id,
            orderId,
            paymentRef: (typeof intent === "string" ? intent : intent?.id) ?? session.id,
            amountCents: session.amount_total ?? 0,
          };
        }
        return {
          kind: "payment.completed",
          id: event.id,
          userId: session.metadata?.["userId"] ?? session.client_reference_id ?? "",
          offer: session.metadata?.["offer"] as OfferId,
          paymentRef: session.id,
          amountCents: session.amount_total ?? 0,
          currency: session.currency ?? session.metadata?.["currency"] ?? DEFAULT_CURRENCY,
        };
      }
      default:
        return { kind: "ignored", id: event.id, type: event.type };
    }
  }
}
