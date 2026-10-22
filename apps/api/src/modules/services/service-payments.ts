import { ValidationError } from "@cvb/shared";
import { Logger } from "@nestjs/common";
import Stripe from "stripe";

export type OrderCheckout = {
  orderId: string;
  userId: string;
  name: string;
  priceCents: number;
  currency: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
};

/**
 * Money for expert services: buyer checkout and refunds, expert payout accounts (Stripe Connect
 * Express) and transfers. A port, so the order rules run the same with Stripe, in development
 * (paid at once) and in tests.
 */
export interface ServicePayments {
  readonly mode: "stripe" | "dev" | "off";
  checkout(o: OrderCheckout): Promise<{ url: string | null; checkoutId: string | null; paidNow: boolean }>;
  /** Refunds all (no amount) or part of a payment; returns the refund id. */
  refund(paymentRef: string | null, amountCents?: number): Promise<string | null>;
  connect(o: { accountId: string | null; email: string; refreshUrl: string; returnUrl: string }): Promise<{ accountId: string; url: string }>;
  accountStatus(accountId: string): Promise<{ payoutsEnabled: boolean }>;
  /** Pays an expert; null when payouts can't run here (logged). */
  transfer(o: { accountId: string | null; amountCents: number; currency: string; orderId: string }): Promise<string | null>;
}

export const SERVICE_PAYMENTS = Symbol.for("cvb.api.ServicePayments");

export class StripeServicePayments implements ServicePayments {
  readonly mode = "stripe" as const;
  private readonly stripe: Stripe;
  private readonly logger = new Logger("ServicePayments");

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey);
  }

  async checkout(o: OrderCheckout) {
    const metadata = { orderId: o.orderId, userId: o.userId };
    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: o.email,
      client_reference_id: o.userId,
      success_url: o.successUrl,
      cancel_url: o.cancelUrl,
      metadata,
      payment_intent_data: { metadata, transfer_group: o.orderId },
      line_items: [{ quantity: 1, price_data: { currency: o.currency, unit_amount: o.priceCents, product_data: { name: o.name } } }],
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { url: session.url, checkoutId: session.id, paidNow: false };
  }

  async refund(paymentRef: string | null, amountCents?: number) {
    if (!paymentRef) return null;
    const refund = await this.stripe.refunds.create({ payment_intent: paymentRef, ...(amountCents ? { amount: amountCents } : {}) });
    return refund.id;
  }

  async connect(o: { accountId: string | null; email: string; refreshUrl: string; returnUrl: string }) {
    const accountId =
      o.accountId ?? (await this.stripe.accounts.create({ type: "express", email: o.email, capabilities: { transfers: { requested: true } } })).id;
    const link = await this.stripe.accountLinks.create({ account: accountId, refresh_url: o.refreshUrl, return_url: o.returnUrl, type: "account_onboarding" });
    return { accountId, url: link.url };
  }

  async accountStatus(accountId: string) {
    const account = await this.stripe.accounts.retrieve(accountId);
    return { payoutsEnabled: Boolean(account.payouts_enabled) };
  }

  async transfer(o: { accountId: string | null; amountCents: number; currency: string; orderId: string }) {
    if (!o.accountId || o.amountCents <= 0) {
      this.logger.warn(`Order ${o.orderId}: expert has no payout account yet; pay out later from the admin page`);
      return null;
    }
    const t = await this.stripe.transfers.create(
      { amount: o.amountCents, currency: o.currency, destination: o.accountId, transfer_group: o.orderId, metadata: { orderId: o.orderId } },
      { idempotencyKey: `payout-${o.orderId}` },
    );
    return t.id;
  }
}

/** Development only (DEV_AUTH, no Stripe key): orders are paid at once so the flow can be tried end to end. */
export class DevServicePayments implements ServicePayments {
  readonly mode = "dev" as const;
  private readonly logger = new Logger("ServicePayments");

  async checkout() {
    return { url: null, checkoutId: null, paidNow: true };
  }

  async refund(paymentRef: string | null, amountCents?: number) {
    this.logger.log(`[dev] refund ${amountCents ?? "all"} of ${paymentRef ?? "nothing"}`);
    return `dev_refund_${Date.now()}`;
  }

  async connect(): Promise<never> {
    throw new ValidationError("Payouts need Stripe (set STRIPE_SECRET_KEY)");
  }

  async accountStatus() {
    return { payoutsEnabled: false };
  }

  async transfer(o: { amountCents: number; orderId: string }) {
    this.logger.log(`[dev] would pay ${o.amountCents} cents to the expert for ${o.orderId}`);
    return `dev_transfer_${o.orderId}`;
  }
}

/** No payment provider configured. */
export class OffServicePayments implements ServicePayments {
  readonly mode = "off" as const;
  async checkout(): Promise<never> {
    throw new ValidationError("Card payments are not configured yet");
  }
  async refund(): Promise<never> {
    throw new ValidationError("Card payments are not configured yet");
  }
  async connect(): Promise<never> {
    throw new ValidationError("Payouts need Stripe (set STRIPE_SECRET_KEY)");
  }
  async accountStatus() {
    return { payoutsEnabled: false };
  }
  async transfer() {
    return null;
  }
}
