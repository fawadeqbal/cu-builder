import type { MrrSubscription } from "@cvb/domain";
import { InMemoryJobProducer } from "@cvb/queue";
import { describe, expect, it } from "vitest";
import type { AppConfig } from "../../config/app-config.js";
import { NullAnalyticsRecorder } from "../analytics/analytics-recorder.js";
import type { BillingProfile, BillingRepository, EventPayment } from "./billing.repository.js";
import { BillingService } from "./billing.service.js";
import { InMemoryPriceSettings } from "./in-memory-price-settings.repository.js";
import type { BillingEvent, CheckoutRequest, PaymentGateway } from "./payment-gateway.js";
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
  payments: ({ id: string } & EventPayment)[] = [];
  stored = new Map<string, MrrSubscription & { cancelAtPeriodEnd: boolean; canceledAt: Date | null }>();
  movements: Parameters<BillingRepository["upsertSubscription"]>[1] = [];
  async findSubscription(ref: string) {
    return this.stored.get(ref) ?? null;
  }
  async profile() {
    return this.profileData;
  }
  async setStripeCustomerId(_: string, id: string) {
    this.profileData.stripeCustomerId = id;
  }
  async userIdForStripeCustomer(id: string) {
    return id === this.profileData.stripeCustomerId ? "u1" : null;
  }
  async upsertSubscription(...[input, movements = []]: Parameters<BillingRepository["upsertSubscription"]>) {
    this.profileData.subscriptions = this.profileData.subscriptions.filter((s) => s.providerRef !== input.providerRef);
    this.profileData.subscriptions.push({ ...input });
    const prev = this.stored.get(input.providerRef);
    this.stored.set(input.providerRef, {
      status: input.status,
      amountCents: input.amountCents ?? prev?.amountCents ?? null,
      interval: input.interval ?? prev?.interval ?? null,
      plan: input.plan === "free" ? "standard" : input.plan,
      currency: input.currency,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      canceledAt: input.canceledAt ?? null,
    });
    this.movements!.push(...movements);
  }
  credits: { userId: string; credits: number }[] = [];
  async addCredits(input: { userId: string; credits: number; providerRef: string }) {
    this.credits.push(input);
  }
  passRecords: Parameters<BillingRepository["addPass"]>[0][] = [];
  async addPass(input: Parameters<BillingRepository["addPass"]>[0]) {
    this.passRecords.push(input);
    this.profileData.passes.push({ plan: input.plan, startsAt: input.startsAt, endsAt: input.endsAt });
  }
  async markEventProcessed(id: string, _type: string, payment?: EventPayment) {
    if (this.events.has(id)) return false;
    this.events.add(id);
    if (payment) this.payments.push({ id, ...payment });
    return true;
  }
}

const config = { APP_URL: "https://app.test" } as AppConfig;
const user = { id: "u1", email: "sara@example.com", name: "Sara", role: "user", emailVerified: true, plan: "free", planSource: "base" } as const;

const admin = { ...user, id: "admin1", role: "admin" } as const;

function setup(gateway: PaymentGateway = new UnavailableGateway("stripe", "off")) {
  const repo = new FakeBillingRepo();
  const jobs = new InMemoryJobProducer();
  const prices = new InMemoryPriceSettings();
  const analytics = new NullAnalyticsRecorder();
  const service = new BillingService(repo, { stripe: gateway, local: new UnavailableGateway("local", "soon") }, jobs, config, prices, analytics);
  return { repo, jobs, prices, service, analytics };
}

/** A gateway that records checkout requests. */
function recordingGateway() {
  const requests: CheckoutRequest[] = [];
  const gateway: PaymentGateway = {
    id: "stripe",
    available: true,
    createCheckout: async (req) => {
      requests.push(req);
      return { url: "https://pay.test/session", customerRef: "cus_new" };
    },
    createPortal: async () => ({ url: "https://portal.test" }),
    parseWebhook: async () => ({ kind: "ignored", id: "evt", type: "x" }),
  };
  return { gateway, requests };
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
      currency: "pkr",
    });
    const status = await service.status({ ...user });
    expect(status).toMatchObject({ plan: "premium", source: "subscription" });
  });

  it("grants a pass and emails a receipt", async () => {
    const { service, jobs } = setup();
    await service.apply({ kind: "payment.completed", id: "evt_2", userId: "u1", offer: "pass_7d", paymentRef: "cs_1", amountCents: 900, currency: "usd" });
    expect((await service.status({ ...user })).plan).toBe("premium");
    expect(jobs.jobs[0]?.payload).toMatchObject({ template: "receipt", amountCents: 900, currency: "USD" });
  });

  it("applies each webhook event once", async () => {
    const event: BillingEvent = { kind: "payment.completed", id: "evt_3", userId: "u1", offer: "pass_30d", paymentRef: "cs_2", amountCents: 1900, currency: "usd" };
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

  it("reports offers as unavailable without a configured gateway", async () => {
    const { service } = setup();
    expect((await service.offers()).every((o) => !o.available)).toBe(true);
  });

  it("prices offers in US dollars by default and in rupees on request", async () => {
    const { service } = setup();
    const usd = await service.offers();
    expect(usd.find((o) => o.id === "premium_monthly")).toMatchObject({ priceCents: 1_500, currency: "usd" });
    const pkr = await service.offers("pkr");
    expect(pkr.find((o) => o.id === "premium_monthly")).toMatchObject({ priceCents: 199_000, currency: "pkr" });
    expect(pkr.find((o) => o.id === "pass_30d")).toMatchObject({ priceCents: 149_000, kind: "pass", days: 30 });
  });

  it("charges the price and currency chosen at checkout, including admin overrides", async () => {
    const { gateway, requests } = recordingGateway();
    const { service, repo } = setup(gateway);
    await service.setPrice(admin, "pass_7d", "pkr", 59_900);

    expect(await service.checkout({ ...user }, "pass_7d", "stripe", "pkr")).toEqual({ url: "https://pay.test/session" });
    expect(requests[0]?.price).toEqual({ amount: 59_900, currency: "pkr" });
    expect(requests[0]?.offer).toMatchObject({ id: "pass_7d", priceCents: 59_900 });
    expect(repo.profileData.stripeCustomerId).toBe("cus_new");

    await service.checkout({ ...user }, "pass_7d", "stripe", "usd");
    expect(requests[1]?.price).toEqual({ amount: 900, currency: "usd" });
    await service.checkout({ ...user }, "premium_yearly", "stripe");
    expect(requests[2]?.price).toEqual({ amount: 12_900, currency: "usd" });
  });

  it("lists, overrides and resets prices", async () => {
    const { service } = setup();
    const before = await service.priceSettings();
    expect(before).toHaveLength(18);
    expect(before.every((p) => !p.overridden && p.updatedAt === null)).toBe(true);

    const set = await service.setPrice(admin, "standard_monthly", "pkr", 89_900);
    expect(set).toMatchObject({ offer: "standard_monthly", currency: "pkr", amount: 89_900, defaultAmount: 99_000, overridden: true, updatedBy: "admin1" });
    expect((await service.offers("pkr")).find((o) => o.id === "standard_monthly")?.priceCents).toBe(89_900);
    expect((await service.offers("usd")).find((o) => o.id === "standard_monthly")?.priceCents).toBe(700);

    const reset = await service.resetPrice(admin, "standard_monthly", "pkr");
    expect(reset).toMatchObject({ amount: 99_000, overridden: false, updatedAt: null });
  });

  it("refuses prices Stripe can't charge", async () => {
    const { service } = setup();
    await expect(service.setPrice(admin, "pass_7d", "usd", 20)).rejects.toThrow(/lowest price/);
    await expect(service.setPrice(admin, "pass_7d", "pkr", 5_000)).rejects.toThrow(/Rs 200/);
  });

  it("records what a pass cost in its currency and emails a rupee receipt", async () => {
    const { service, repo, jobs } = setup();
    await service.apply({ kind: "payment.completed", id: "evt_pkr", userId: "u1", offer: "pass_7d", paymentRef: "cs_pkr", amountCents: 69_000, currency: "pkr" });
    expect(repo.passRecords[0]).toMatchObject({ amountCents: 69_000, currency: "pkr", offer: "pass_7d" });
    expect(jobs.jobs[0]?.payload).toMatchObject({ template: "receipt", amountCents: 69_000, currency: "PKR" });
  });

  it("records the amount and currency of a processed payment event", async () => {
    const event: BillingEvent = { kind: "payment.completed", id: "evt_9", userId: "u1", offer: "credits_100", paymentRef: "cs_9", amountCents: 59_000, currency: "pkr" };
    const gateway: PaymentGateway = { ...recordingGateway().gateway, parseWebhook: async () => event };
    const { service, repo } = setup(gateway);
    await service.handleWebhook("stripe", Buffer.from("{}"), "sig");
    expect(repo.payments).toEqual([{ id: "evt_9", amountCents: 59_000, currency: "pkr", userId: "u1", offer: "credits_100" }]);
    expect(repo.credits).toHaveLength(1);
  });

  const subEvent = (o: Partial<Extract<BillingEvent, { kind: "subscription.changed" }>> = {}): BillingEvent => ({
    kind: "subscription.changed",
    id: "evt_s",
    customerRef: "cus_1",
    userId: "u1",
    subscriptionRef: "sub_1",
    plan: "premium",
    status: "active",
    currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
    cancelAtPeriodEnd: false,
    currency: "usd",
    offer: "premium_yearly",
    amountCents: 12_900,
    interval: "year",
    ...o,
  });

  it("records MRR movements: new, expansion and churn, yearly plans as a twelfth", async () => {
    const { service, repo, analytics } = setup();
    await service.apply(subEvent() as Extract<BillingEvent, { kind: "subscription.changed" }>);
    await service.apply(subEvent({ id: "evt_s2" }) as Extract<BillingEvent, { kind: "subscription.changed" }>);
    await service.apply(
      subEvent({ id: "evt_s3", plan: "executive", offer: "executive_monthly", amountCents: 3_900, interval: "month" }) as Extract<
        BillingEvent,
        { kind: "subscription.changed" }
      >,
    );
    await service.apply(subEvent({ id: "evt_s4", plan: "executive", status: "canceled", amountCents: 3_900, interval: "month" }) as Extract<
      BillingEvent,
      { kind: "subscription.changed" }
    >);
    expect(repo.movements!.map((m) => [m.kind, m.deltaCents])).toEqual([
      ["new", 1075],
      ["expansion", 2825],
      ["churn", -3900],
    ]);
    expect(repo.stored.get("sub_1")?.canceledAt).toBeInstanceOf(Date);
    expect(analytics.recorded.map((r) => r.name)).toEqual(["subscription_started", "subscription_cancelled"]);
  });

  it("doesn't count a trial as MRR until it converts", async () => {
    const { service, repo } = setup();
    await service.apply(subEvent({ status: "trialing" }) as Extract<BillingEvent, { kind: "subscription.changed" }>);
    expect(repo.movements).toHaveLength(0);
    await service.apply(subEvent({ id: "evt_t2" }) as Extract<BillingEvent, { kind: "subscription.changed" }>);
    expect(repo.movements!.map((m) => m.kind)).toEqual(["new"]);
  });

  it("stores renewals, failed payments and refunds with who paid", async () => {
    const events: BillingEvent[] = [
      { kind: "invoice.paid", id: "in_1", customerRef: "cus_1", userId: null, subscriptionRef: "sub_1", offer: "premium_monthly", reason: "renewal", amountCents: 1500, currency: "usd" },
      { kind: "invoice.payment_failed", id: "in_2", customerRef: "cus_1", userId: null, subscriptionRef: "sub_1", amountCents: 1500, currency: "usd" },
      { kind: "charge.refunded", id: "ch_1", customerRef: null, userId: "u1", amountCents: 900, currency: "usd" },
    ];
    let next = 0;
    const gateway: PaymentGateway = { ...recordingGateway().gateway, parseWebhook: async () => events[next++]! };
    const { service, repo, analytics } = setup(gateway);
    repo.profileData.stripeCustomerId = "cus_1";
    for (let i = 0; i < events.length; i++) await service.handleWebhook("stripe", Buffer.from("{}"), "sig");
    expect(repo.payments).toEqual([
      { id: "in_1", amountCents: 1500, currency: "usd", userId: "u1", offer: "premium_monthly" },
      { id: "in_2", amountCents: 1500, currency: "usd", userId: "u1", offer: null },
      { id: "ch_1", amountCents: 900, currency: "usd", userId: "u1", offer: null },
    ]);
    expect(analytics.recorded.map((r) => r.name)).toEqual(["subscription_renewed", "payment_failed", "payment_refunded"]);
  });

  it("records a completed purchase as a server-side event", async () => {
    const { service, analytics } = setup();
    await service.apply({ kind: "payment.completed", id: "evt_p", userId: "u1", offer: "credits_100", paymentRef: "cs_p", amountCents: 500, currency: "usd" });
    expect(analytics.recorded).toEqual([{ name: "purchase_completed", userId: "u1", props: { offer: "credits_100", kind: "credits", amount: 500 } }]);
  });
});
