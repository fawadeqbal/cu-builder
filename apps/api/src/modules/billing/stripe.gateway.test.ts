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
          metadata: { userId: "u1", offer: "premium_monthly", plan: "premium" },
          items: { data: [{ current_period_end: periodEnd }] },
        },
      },
    });
    const event = await gateway.parseWebhook(body, header);
    expect(event).toMatchObject({ kind: "subscription.changed", userId: "u1", plan: "premium", status: "active", subscriptionRef: "sub_123" });
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
    expect(await gateway.parseWebhook(body, header)).toMatchObject({ kind: "pass.purchased", offer: "pass_7d", amountCents: 900 });
  });

  it("rejects bad signatures", async () => {
    await expect(gateway.parseWebhook(Buffer.from("{}"), "t=1,v1=bad")).rejects.toThrow("Invalid webhook signature");
  });
});
