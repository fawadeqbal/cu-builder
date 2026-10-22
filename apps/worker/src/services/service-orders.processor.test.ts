import type { JobProducer } from "@cvb/queue";
import type { Queue } from "bullmq";
import { describe, expect, it } from "vitest";
import type { WorkerConfig } from "../config/worker-config.js";
import type { ServiceOrdersStore } from "./orders.store.js";
import { ServiceOrdersProcessor } from "./service-orders.processor.js";

const now = new Date("2026-10-22T12:00:00Z");

function setup() {
  const sent: { payload: { to?: string; subject?: string }; jobId?: string }[] = [];
  const completed: string[] = [];
  const transfers: Record<string, string> = {};
  const store: ServiceOrdersStore = {
    dueBefore: async () => [
      { id: "soon", kind: "review", dueAt: new Date("2026-10-22T15:00:00Z"), expert: { email: "ali@x.dev", displayName: "Ali" } },
      { id: "late", kind: "review_rush", dueAt: new Date("2026-10-22T09:00:00Z"), expert: { email: "ali@x.dev", displayName: "Ali" } },
    ],
    staleDeliveries: async () => [
      { id: "o1", kind: "review", priceCents: 0, included: true, durationMin: null, currency: "usd", buyer: { email: "b@x.dev", name: "B" }, expert: { email: "ali@x.dev", displayName: "Ali", stripeAccountId: "acct_1", payoutsEnabled: true } },
    ],
    complete: async (id) => (completed.push(id), true),
    setTransfer: async (id, t) => void (transfers[id] = t),
  };
  const jobs: JobProducer = { enqueue: async (_q, _n, payload, opts) => (sent.push({ payload: payload as never, jobId: opts?.jobId }), "1") };
  const amounts: number[] = [];
  const processor = new ServiceOrdersProcessor(store, jobs, async (o) => (amounts.push(o.amountCents), "tr_1"), {} as Queue);
  (processor as unknown as { config: Partial<WorkerConfig> }).config = { APP_URL: "https://app.test", ADMIN_EMAILS: ["ops@x.dev"] };
  return { processor, sent, completed, transfers, amounts };
}

describe("ServiceOrdersProcessor", () => {
  it("warns about due and overdue orders, including admins for late ones", async () => {
    const { processor, sent } = setup();
    expect(await processor.deadlines(now)).toEqual({ dueSoon: 1, overdue: 1 });
    expect(sent.map((s) => s.payload.subject)).toEqual(["Due soon: CV review", "Overdue: CV review, 24-hour rush", "Overdue order late"]);
    expect(sent.every((s) => !s.jobId?.includes(":"))).toBe(true);
  });

  it("completes week-old deliveries and pays the expert their share of the list price", async () => {
    const { processor, completed, transfers, amounts } = setup();
    expect(await processor.autocomplete(now)).toEqual({ completed: 1, paid: 1 });
    expect(completed).toEqual(["o1"]);
    expect(transfers).toEqual({ o1: "tr_1" });
    expect(amounts).toEqual([2925]);
  });
});
