import { InMemoryJobProducer } from "@cvb/queue";
import { describe, expect, it } from "vitest";
import type { AppConfig } from "../../config/app-config.js";
import type { BillingProfile, BillingRepository } from "./billing.repository.js";
import { BillingService } from "./billing.service.js";
import type { BillingEvent, PaymentGateway } from "./payment-gateway.js";
import { UnavailableGateway } from "./unavailable.gateway.js";

class FakeBillingRepo implements BillingRepository {
  profileData: BillingProfile = {
    userId: "u1",
    email: "sara@example.com",
    name: "Sara",
    basePlan: "free",
    stripeCustomerId: null,
    subscriptions: [],
    passes: [],
  };
  events = new Set<string>();
  async profile() {
    return this.profileData;
  }
  async setStripeCustomerId(_: string, id: string) {
    this.profileData.stripeCustomerId = id;
  }
  async userIdForStripeCustomer(id: string) {
    return id === this.profileData.stripeCustomerId ? "u1" : null;
  }
  async upsertSubscription(input: Parameters<BillingRepository["upsertSubscription"]>[0]) {
    this.profileData.subscriptions = this.profileData.subscriptions.filter((s) => s.providerRef !== input.providerRef);
    this.profileData.subscriptions.push({ ...input });
  }
  async addPass(input: Parameters<BillingRepository["addPass"]>[0]) {
    this.profileData.passes.push({ plan: input.plan, startsAt: input.startsAt, endsAt: input.endsAt });
  }
  async markEventProcessed(id: string) {
    if (this.events.has(id)) return false;
    this.events.add(id);
    return true;
  }
}

const config = { APP_URL: "https://app.test" } as AppConfig;
const user = { id: "u1", email: "sara@example.com", name: "Sara", role: "user", emailVerified: true, plan: "free", planSource: "base" } as const;

function setup(gateway: PaymentGateway = new UnavailableGateway("stripe", "off")) {
  const repo = new FakeBillingRepo();
  const jobs = new InMemoryJobProducer();
  const service = new BillingService(repo, { stripe: gateway, local: new UnavailableGateway("local", "soon") }, jobs, config);
  return { repo, jobs, service };
}

describe("BillingService", () => {
  it("activates a subscription from a provider event", async () => {
    const { service } = setup();
    await service.apply({
      kind: "subscription.changed",
      id: "evt_1",
      customerRef: "cus_1",
      userId: "u1",
      subscriptionRef: "sub_1",
      plan: "premium",
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 86_400_000),
      cancelAtPeriodEnd: false,
    });
    const status = await service.status({ ...user });
    expect(status).toMatchObject({ plan: "premium", source: "subscription" });
  });

  it("grants a pass and emails a receipt", async () => {
    const { service, jobs } = setup();
    await service.apply({ kind: "pass.purchased", id: "evt_2", userId: "u1", offer: "pass_7d", paymentRef: "cs_1", amountCents: 900, currency: "usd" });
    expect((await service.status({ ...user })).plan).toBe("premium");
    expect(jobs.jobs[0]?.payload).toMatchObject({ template: "receipt", amountCents: 900, currency: "USD" });
  });

  it("applies each webhook event once", async () => {
    const event: BillingEvent = { kind: "pass.purchased", id: "evt_3", userId: "u1", offer: "pass_30d", paymentRef: "cs_2", amountCents: 1900, currency: "usd" };
    const gateway: PaymentGateway = {
      id: "stripe",
      available: true,
      createCheckout: async () => ({ url: "https://pay.test" }),
      createPortal: async () => ({ url: "https://portal.test" }),
      parseWebhook: async () => event,
    };
    const { service, repo } = setup(gateway);
    await service.handleWebhook("stripe", Buffer.from("{}"), "sig");
    await service.handleWebhook("stripe", Buffer.from("{}"), "sig");
    expect(repo.profileData.passes).toHaveLength(1);
  });

  it("reports offers as unavailable without a configured gateway", () => {
    const { service } = setup();
    expect(service.offers().every((o) => !o.available)).toBe(true);
  });
});
