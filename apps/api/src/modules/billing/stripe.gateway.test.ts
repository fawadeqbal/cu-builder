import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { StripeGateway } from "./stripe.gateway.js";

const secret = "whsec_test_secret";
const gateway = new StripeGateway("sk_test_dummy", secret);
const stripe = new Stripe("sk_test_dummy");

function signed(event: object) {
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  return { body: Buffer.from(payload), header };
}

describe("StripeGateway.parseWebhook", () => {
  it("normalises a subscription update", async () => {
    const periodEnd = Math.floor(Date.now() / 1000) + 30 * 86_400;
    const { body, header } = signed({
      id: "evt_sub",
      object: "event",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_123",
          object: "subscription",
          customer: "cus_123",
          status: "active",
          cancel_at_period_end: false,
          currency: "pkr",
          metadata: { userId: "u1", offer: "premium_monthly", plan: "premium", currency: "pkr" },
          items: { data: [{ current_period_end: periodEnd, quantity: 1, price: { unit_amount: 199_000, recurring: { interval: "month" } } }] },
        },
      },
    });
    const event = await gateway.parseWebhook(body, header);
    expect(event).toMatchObject({
      kind: "subscription.changed",
      userId: "u1",
      plan: "premium",
      status: "active",
      subscriptionRef: "sub_123",
      currency: "pkr",
      offer: "premium_monthly",
      amountCents: 199_000,
      interval: "month",
    });
  });

  it("normalises a renewal invoice and a failed one", async () => {
    const invoice = (type: string, extra: object) =>
      signed({
        id: `evt_${type}`,
        object: "event",
        type,
        data: {
          object: {
            id: "in_1",
            object: "invoice",
            customer: "cus_1",
            currency: "usd",
            parent: { type: "subscription_details", subscription_details: { subscription: "sub_1", metadata: { userId: "u1", offer: "premium_monthly" } } },
            ...extra,
          },
        },
      });
    const paid = invoice("invoice.paid", { billing_reason: "subscription_cycle", amount_paid: 1500 });
    expect(await gateway.parseWebhook(paid.body, paid.header)).toMatchObject({
      kind: "invoice.paid",
      reason: "renewal",
      userId: "u1",
      subscriptionRef: "sub_1",
      offer: "premium_monthly",
      amountCents: 1500,
    });
    const failed = invoice("invoice.payment_failed", { billing_reason: "subscription_cycle", amount_due: 1500, amount_paid: 0 });
    expect(await gateway.parseWebhook(failed.body, failed.header)).toMatchObject({ kind: "invoice.payment_failed", amountCents: 1500, userId: "u1" });
  });

  it("normalises a refund to the newest refund's amount", async () => {
    const { body, header } = signed({
      id: "evt_refund",
      object: "event",
      type: "charge.refunded",
      data: {
        object: {
          id: "ch_1",
          object: "charge",
          customer: "cus_1",
          currency: "pkr",
          amount_refunded: 100_000,
          metadata: { userId: "u1" },
          refunds: { data: [{ id: "re_2", amount: 40_000 }] },
        },
      },
    });
    expect(await gateway.parseWebhook(body, header)).toMatchObject({ kind: "charge.refunded", amountCents: 40_000, currency: "pkr", userId: "u1" });
  });

  it("normalises a paid pass checkout", async () => {
    const { body, header } = signed({
      id: "evt_pass",
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_123",
          object: "checkout.session",
          mode: "payment",
          payment_status: "paid",
          amount_total: 900,
          currency: "usd",
          client_reference_id: "u1",
          metadata: { userId: "u1", offer: "pass_7d" },
        },
      },
    });
    expect(await gateway.parseWebhook(body, header)).toMatchObject({ kind: "payment.completed", offer: "pass_7d", amountCents: 900 });
  });

  it("recognises a paid expert order", async () => {
    const { body, header } = signed({
      id: "evt_order",
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_order",
          object: "checkout.session",
          mode: "payment",
          payment_status: "paid",
          payment_intent: "pi_order",
          amount_total: 3900,
          currency: "usd",
          metadata: { userId: "u1", orderId: "o1" },
        },
      },
    });
    expect(await gateway.parseWebhook(body, header)).toMatchObject({ kind: "order.paid", orderId: "o1", paymentRef: "pi_order", amountCents: 3900 });
  });

  it("rejects bad signatures", async () => {
    await expect(gateway.parseWebhook(Buffer.from("{}"), "t=1,v1=bad")).rejects.toThrow("Invalid webhook signature");
  });
});
