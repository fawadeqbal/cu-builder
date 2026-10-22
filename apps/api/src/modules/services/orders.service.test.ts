import type { JobProducer } from "@cvb/queue";
import { NotFoundError, ValidationError } from "@cvb/shared";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { ExpertsService } from "./experts.service.js";
import type { ExpertRow, MessageRow, NewOrder, OrderPatch, OrderRow, OrdersStore } from "./orders.store.js";
import { OrdersService } from "./orders.service.js";
import { DevServicePayments, type ServicePayments } from "./service-payments.js";

const user = (id: string, plan: AuthUser["plan"] = "free", role: AuthUser["role"] = "user"): AuthUser => ({
  id,
  email: `${id}@example.com`,
  name: id,
  role,
  emailVerified: true,
  plan,
  planSource: "base",
});

/** The store in memory: enough Prisma behaviour for the order rules. */
class MemoryStore implements OrdersStore {
  experts_ = new Map<string, ExpertRow>();
  orders_ = new Map<string, Omit<OrderRow, "buyer" | "expert" | "resumeTitle">>();
  msgs: MessageRow[] = [];
  resumes = new Map<string, { id: string; title: string; userId: string }>();
  n = 0;

  async expert(id: string) {
    return this.experts_.get(id) ?? null;
  }
  async experts(f: { status?: string; service?: string }) {
    return [...this.experts_.values()].filter((e) => (!f.status || e.status === f.status) && (!f.service || e.services.includes(f.service)));
  }
  async saveExpert(userId: string, data: Partial<ExpertRow>) {
    const prev = this.experts_.get(userId);
    const row: ExpertRow = {
      userId,
      email: `${userId}@example.com`,
      displayName: "Expert",
      headline: "",
      bio: "",
      photoUrl: null,
      specialties: [],
      languages: [],
      services: [],
      status: "pending",
      timezone: "UTC",
      availability: [],
      maxActiveOrders: 5,
      stripeAccountId: null,
      payoutsEnabled: false,
      ratingAvg: 0,
      ratingCount: 0,
      approvedAt: null,
      ...prev,
      ...data,
    };
    this.experts_.set(userId, row);
    return row;
  }
  async activeCounts(ids: string[], statuses: string[]) {
    const m = new Map<string, number>();
    for (const o of this.orders_.values()) if (o.expertId && ids.includes(o.expertId) && statuses.includes(o.status)) m.set(o.expertId, (m.get(o.expertId) ?? 0) + 1);
    return m;
  }
  async bookings(expertId: string) {
    return [...this.orders_.values()]
      .filter((o) => o.expertId === expertId && o.scheduledAt && ["paid", "in_progress"].includes(o.status))
      .map((o) => ({ start: o.scheduledAt!, end: new Date(o.scheduledAt!.getTime() + (o.durationMin ?? 60) * 60_000) }));
  }
  async includedSince(userId: string) {
    return [...this.orders_.values()].filter((o) => o.userId === userId && o.included).length;
  }
  async resume(userId: string, id: string) {
    const r = this.resumes.get(id);
    return r && r.userId === userId ? { id: r.id, title: r.title } : null;
  }
  async user(id: string) {
    return { id, name: id, email: `${id}@example.com` };
  }
  async createOrder(d: NewOrder) {
    const id = `o${++this.n}`;
    this.orders_.set(id, {
      ...d,
      id,
      status: "pending_payment",
      dueAt: null,
      meetingUrl: null,
      deliveryNote: "",
      revisionsUsed: 0,
      rating: null,
      ratingComment: "",
      checkoutId: null,
      paymentId: null,
      refundId: null,
      transferId: null,
      refundReason: "",
      dispute: null,
      paidAt: null,
      assignedAt: null,
      deliveredAt: null,
      completedAt: null,
      cancelledAt: null,
      createdAt: new Date(),
    });
    return (await this.order(id))!;
  }
  async order(id: string): Promise<OrderRow | null> {
    const o = this.orders_.get(id);
    if (!o) return null;
    const e = o.expertId ? this.experts_.get(o.expertId) : null;
    return {
      ...o,
      buyer: { id: o.userId, name: o.userId, email: `${o.userId}@example.com` },
      expert: e ? { userId: e.userId, displayName: e.displayName, photoUrl: null, email: e.email, stripeAccountId: e.stripeAccountId, payoutsEnabled: e.payoutsEnabled } : null,
      resumeTitle: o.resumeId ? (this.resumes.get(o.resumeId)?.title ?? null) : null,
    };
  }
  async updateOrder(id: string, patch: OrderPatch, from?: string[]) {
    const o = this.orders_.get(id);
    if (!o || (from && !from.includes(o.status))) return null;
    this.orders_.set(id, { ...o, ...patch } as typeof o);
    return this.order(id);
  }
  async orders(w: { userId?: string; expertId?: string; status?: string }) {
    const out: OrderRow[] = [];
    for (const o of this.orders_.values())
      if ((!w.userId || o.userId === w.userId) && (!w.expertId || o.expertId === w.expertId) && (!w.status || o.status === w.status)) out.push((await this.order(o.id))!);
    return out;
  }
  async messages(orderId: string) {
    return this.msgs.filter((m) => m.orderId === orderId);
  }
  async addMessage(orderId: string, authorId: string, body: string) {
    const m = { id: `m${this.msgs.length}`, orderId, authorId, authorName: authorId, body, createdAt: new Date() };
    this.msgs.push(m);
    return m;
  }
}

const emails: { payload: unknown }[] = [];
const jobs: JobProducer = { enqueue: async (_q, _n, payload) => (emails.push({ payload }), "1") };
const config = { APP_URL: "https://app.test", ADMIN_EMAILS: ["ops@example.com"] };

describe("expert orders", () => {
  let store: MemoryStore;
  let payments: ServicePayments;
  let orders: OrdersService;
  let experts: ExpertsService;
  const buyer = user("buyer");

  beforeEach(async () => {
    emails.length = 0;
    store = new MemoryStore();
    payments = new DevServicePayments();
    orders = new OrdersService(store, payments, jobs, config);
    experts = new ExpertsService(store, payments, jobs, config);
    store.resumes.set("r1", { id: "r1", title: "My CV", userId: "buyer" });
    await experts.save(user("ali"), { displayName: "Ali", headline: "", bio: "", photoUrl: null, specialties: [], languages: ["English"], services: ["review", "coaching"], timezone: "UTC", availability: [{ day: 1, start: "09:00", end: "12:00" }], maxActiveOrders: 1 });
    await experts.save(user("sara"), { displayName: "Sara", headline: "", bio: "", photoUrl: null, specialties: [], languages: ["Urdu"], services: ["review", "writing"], timezone: "UTC", availability: [], maxActiveOrders: 5 });
  });

  it("lists only approved experts and tells admins about applications", async () => {
    expect(await experts.directory({})).toHaveLength(0);
    expect(emails.some((e) => JSON.stringify(e.payload).includes("New expert application: Ali"))).toBe(true);
    await experts.setStatus("ali", "approved");
    expect((await experts.directory({ service: "review" })).map((e) => e.displayName)).toEqual(["Ali"]);
    expect(await experts.directory({ language: "urdu" })).toHaveLength(0);
  });

  it("runs a review end to end: pay (dev), assign the least busy expert, comment, deliver, complete, pay out", async () => {
    await experts.setStatus("ali", "approved");
    await experts.setStatus("sara", "approved");
    // Ali is busy (capacity 1).
    await store.createOrder({ userId: "x", expertId: "ali", kind: "review", resumeId: null, priceCents: 3900, currency: "usd", commissionCents: 975, included: false, intake: {}, scheduledAt: null, durationMin: null, revisionsIncluded: 0 });
    store.orders_.get("o1")!.status = "paid";

    const { order, checkoutUrl } = await orders.create(buyer, { kind: "review", resumeId: "r1", intake: {} }, new Date("2026-10-22T10:00:00Z"));
    expect(checkoutUrl).toBeNull();
    expect(order.status).toBe("paid");
    expect(order.expert?.displayName).toBe("Sara");
    expect(order.dueAt).toBe("2026-10-24T10:00:00.000Z");

    const sara = user("sara");
    await orders.start(sara, order.id);
    await orders.deliver(sara, order.id, "See my comments");
    const done = await orders.complete(buyer, order.id, 5, "Great");
    expect(done.status).toBe("completed");
    expect(done.paidOut).toBe(true);
    expect((await store.expert("sara"))!.ratingAvg).toBe(5);
    await expect(orders.complete(buyer, order.id, 4, "")).rejects.toBeInstanceOf(ValidationError);
  });

  it("includes one review a month on Executive without payment", async () => {
    await experts.setStatus("sara", "approved");
    const exec = user("buyer", "executive");
    const first = await orders.create(exec, { kind: "review", resumeId: "r1", intake: {} });
    expect(first.order.included).toBe(true);
    expect(first.order.priceCents).toBe(0);
    const second = await orders.create(exec, { kind: "review", resumeId: "r1", intake: {} });
    expect(second.order.included).toBe(false);
    expect(second.order.priceCents).toBe(3900);
  });

  it("checks the CV, the intake and the coaching slot", async () => {
    await experts.setStatus("ali", "approved");
    await expect(orders.create(buyer, { kind: "review", resumeId: "nope", intake: {} })).rejects.toBeInstanceOf(NotFoundError);
    await expect(orders.create(buyer, { kind: "writing", resumeId: "r1", intake: { target: "PM" } })).rejects.toThrow(/proudest achievements/);
    const now = new Date("2026-10-22T00:00:00Z"); // Thursday
    await expect(orders.create(buyer, { kind: "coaching", expertId: "ali", intake: { goals: "Interview" }, scheduledAt: "2026-10-26T08:00:00.000Z", durationMin: 60 }, now)).rejects.toThrow(/just taken/);
    const ok = await orders.create(buyer, { kind: "coaching", expertId: "ali", intake: { goals: "Interview" }, scheduledAt: "2026-10-26T09:00:00.000Z", durationMin: 60 }, now);
    expect(ok.order.meetingUrl).toBe(`https://meet.jit.si/cvb-${ok.order.id}`);
    expect(ok.order.calendarUrl).toContain("calendar.google.com");
    expect(await orders.calendar(buyer, ok.order.id)).toContain("DTSTART:20261026T090000Z");
    // The slot is now taken.
    await expect(orders.create(buyer, { kind: "coaching", expertId: "ali", intake: { goals: "x" }, scheduledAt: "2026-10-26T09:00:00.000Z", durationMin: 60 }, now)).rejects.toThrow(/just taken/);
  });

  it("handles revisions, disputes and refunds", async () => {
    await experts.setStatus("sara", "approved");
    const { order } = await orders.create(buyer, { kind: "writing", resumeId: "r1", intake: { target: "PM", achievements: "Shipped" } });
    const sara = user("sara");
    await orders.deliver(sara, order.id, "Draft 1");
    expect((await orders.requestRevision(buyer, order.id, "Shorter please")).revisionsUsed).toBe(1);
    await orders.deliver(sara, order.id, "Draft 2");
    await orders.requestRevision(buyer, order.id, "Again");
    await orders.deliver(sara, order.id, "Draft 3");
    await expect(orders.requestRevision(buyer, order.id, "More")).rejects.toThrow(/used the included/);
    const disputed = await orders.dispute(buyer, order.id, "The writer ignored my notes");
    expect(disputed.status).toBe("disputed");
    const refunded = await orders.resolveDispute(order.id, { outcome: "refund", amountCents: 5000, note: "Partial refund agreed" });
    expect(refunded.status).toBe("refunded");
    expect(refunded.dispute?.resolution).toContain("refund");
  });

  it("only lets the buyer, the expert and admins see an order", async () => {
    await experts.setStatus("sara", "approved");
    const { order } = await orders.create(buyer, { kind: "review", resumeId: "r1", intake: {} });
    await expect(orders.get(user("stranger"), order.id)).rejects.toBeInstanceOf(NotFoundError);
    expect((await orders.get(user("sara"), order.id)).viewerRole).toBe("expert");
    expect((await orders.get(user("boss", "free", "admin"), order.id)).viewerRole).toBe("admin");
    expect((await orders.get(buyer, order.id)).expertCents).toBeNull();
    await expect(orders.deliver(buyer, order.id, "x")).rejects.toThrow(/Only the expert/);
  });

  it("is idempotent when the payment webhook arrives twice", async () => {
    await experts.setStatus("sara", "approved");
    const stripeLike: ServicePayments = { ...payments, mode: "stripe", checkout: async () => ({ url: "https://pay.test", checkoutId: "cs_1", paidNow: false }) };
    const svc = new OrdersService(store, stripeLike, jobs, config);
    const { order, checkoutUrl } = await svc.create(buyer, { kind: "review", resumeId: "r1", intake: {} });
    expect(checkoutUrl).toBe("https://pay.test");
    expect(order.status).toBe("pending_payment");
    await svc.markPaid(order.id, "pi_1");
    const sent = emails.length;
    await svc.markPaid(order.id, "pi_1");
    expect(emails.length).toBe(sent);
    expect((await store.order(order.id))!.paymentId).toBe("pi_1");
  });
});
