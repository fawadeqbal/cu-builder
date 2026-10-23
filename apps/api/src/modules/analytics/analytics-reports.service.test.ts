import { AnalyticsQuerySchema } from "@cvb/contracts";
import { describe, expect, it } from "vitest";
import type { AnalyticsReportsRepository, FunnelRow, ReportWindow, RevenueRows } from "./analytics-reports.repository.js";
import { AnalyticsReportsService } from "./analytics-reports.service.js";

const NOW = new Date("2026-10-23T12:00:00Z");
const q = (o: Record<string, string> = {}) => AnalyticsQuerySchema.parse({ range: "7d", ...o });
const isCurrent = (w: ReportWindow) => w.from.toISOString() === "2026-10-17T00:00:00.000Z";

const noMoney: RevenueRows = { totals: [], series: [], payers: [], refunds: [], failed: [] };
const row = (o: Partial<FunnelRow>): FunnelRow => ({
  visited: true,
  started: false,
  downloaded: false,
  signedUp: false,
  paid: false,
  tool: false,
  toolName: null,
  source: "(direct)",
  device: "desktop",
  count: 1,
  ...o,
});

/** A query port whose answers depend only on whether the window is the current or the previous period. */
function fakeRepo(over: Partial<AnalyticsReportsRepository> = {}): AnalyticsReportsRepository & { calls: number } {
  const repo = {
    calls: 0,
    dataSince: async () => new Date("2026-09-01T00:00:00Z"),
    traffic: async (w: ReportWindow) => {
      repo.calls++;
      return isCurrent(w)
        ? { visitors: 200, sessions: 260, downloads: 30, starters: 60, series: [{ key: "2026-10-23", visitors: 50, sessions: 60, downloads: 9 }] }
        : { visitors: 100, sessions: 130, downloads: 20, starters: 20, series: [{ key: "2026-10-16", visitors: 20, sessions: 25, downloads: 3 }] };
    },
    signups: async (w: ReportWindow) => (isCurrent(w) ? { total: 20, paid: 4, series: [] } : { total: 10, paid: 1, series: [] }),
    cvsCreated: async (w: ReportWindow) => (isCurrent(w) ? { total: 50, series: [] } : { total: 40, series: [] }),
    payers: async (w: ReportWindow) => (isCurrent(w) ? { total: 4, series: [] } : { total: 1, series: [] }),
    revenue: async (w: ReportWindow): Promise<RevenueRows> =>
      isCurrent(w)
        ? {
            totals: [
              { currency: "usd", kind: "pass", count: 2, cents: 1800 },
              { currency: "usd", kind: "sub_start", count: 1, cents: 0 },
              { currency: "pkr", kind: "credits", count: 1, cents: 59_000 },
            ],
            series: [{ currency: "usd", key: "2026-10-22", cents: 1800 }],
            payers: [{ currency: "usd", users: 2 }],
            refunds: [],
            failed: [{ currency: "usd", count: 1 }],
          }
        : noMoney,
    funnelGroups: async () => [
      row({ count: 60 }),
      row({ started: true, count: 20, source: "google" }),
      row({ started: true, downloaded: true, signedUp: true, count: 8, source: "google" }),
      row({ started: true, downloaded: true, signedUp: true, paid: true, count: 2, device: "mobile" }),
      row({ visited: true, tool: true, toolName: "ats_checker", started: true, count: 5 }),
    ],
    acquisition: async () => [
      { dim: "source" as const, value: "google", visitors: 40, signups: 4, paid: 1 },
      { dim: "source" as const, value: "(direct)", visitors: 60, signups: 3, paid: 0 },
      { dim: "campaign" as const, value: null, visitors: 90, signups: 6, paid: 1 },
      { dim: "landing" as const, value: "/cv-examples/nurse", visitors: 12, signups: 1, paid: 0 },
    ],
    visitorMix: async () => ({ new: 70, returning: 30, series: [{ key: "2026-10-20", new: 10, returning: 4 }] }),
    mrrAt: async (at: Date) =>
      at.toISOString().startsWith("2026-10-24")
        ? [{ currency: "usd", mrr: 4000, subscriptions: 3 }]
        : at.toISOString().startsWith("2026-10-17")
          ? [{ currency: "usd", mrr: 3000, subscriptions: 2 }]
          : [{ currency: "usd", mrr: 2000, subscriptions: 2 }],
    movements: async () => [
      { currency: "usd", kind: "new", current: true, key: "2026-10-18", count: 1, cents: 1500 },
      { currency: "usd", kind: "churn", current: true, key: "2026-10-20", count: 1, cents: -500 },
      { currency: "usd", kind: "new", current: false, key: "2026-10-12", count: 1, cents: 1000 },
    ],
    livePlans: async () => [
      { currency: "usd", plan: "premium", interval: "year", amountCents: 12_900, status: "active", count: 2 },
      { currency: "usd", plan: "standard", interval: null, amountCents: null, status: "past_due", count: 1 },
    ],
    active: async (w: ReportWindow) => (isCurrent(w) ? { personDays: 70, wau: 30, mau: 50, series: [] } : { personDays: 35, wau: 20, mau: 40, series: [] }),
    featureUsage: async () => [{ feature: "ai", events: 40, users: 12 }],
    topEvents: async () => [{ name: "page_view", events: 900, people: 200 }],
    credits: async () => ({ spent: 120, users: 9 }),
    cohorts: async () => ({ cohorts: [{ week: "2026-10-12", size: 10 }], activity: [{ week: "2026-10-12", offset: 1, users: 3 }] }),
    ...over,
  };
  return repo;
}

describe("AnalyticsReportsService", () => {
  it("builds the overview with comparisons, rates and revenue per currency", async () => {
    const service = new AnalyticsReportsService(fakeRepo(), () => NOW);
    const o = await service.overview(q({ compare: "1" }));
    expect(o.period).toMatchObject({ from: "2026-10-17", to: "2026-10-23", prevFrom: "2026-10-10", prevTo: "2026-10-16", compare: true });
    expect(o.tiles.visitors).toEqual({ value: 200, previous: 100, change: 1 });
    expect(o.rates.visitorToSignup.value).toBeCloseTo(0.1);
    expect(o.rates.signupToPaid).toMatchObject({ value: 0.2, previous: 0.1 });
    expect(o.rates.visitorToCv).toMatchObject({ value: 0.3, previous: 0.2 });
    expect(o.revenue.map((r) => [r.currency, r.cents.value])).toEqual([
      ["usd", 1800],
      ["pkr", 59_000],
    ]);
    expect(o.series.visitors).toHaveLength(7);
    expect(o.series.visitors.at(-1)).toEqual({ date: "2026-10-23", value: 50, previous: 20 });
  });

  it("leaves comparisons empty when compare is off", async () => {
    const o = await new AnalyticsReportsService(fakeRepo(), () => NOW).overview(q());
    expect(o.tiles.visitors.previous).toBeNull();
    expect(o.series.visitors[0]?.previous).toBeNull();
  });

  it("caches a report for a few minutes", async () => {
    const repo = fakeRepo();
    let now = NOW;
    const service = new AnalyticsReportsService(repo, () => now);
    await service.overview(q());
    await service.overview(q());
    expect(repo.calls).toBe(1);
    now = new Date(NOW.getTime() + 6 * 60_000);
    await service.overview(q());
    expect(repo.calls).toBe(2);
  });

  it("assembles the funnels and their breakdowns", async () => {
    const f = await new AnalyticsReportsService(fakeRepo(), () => NOW).funnel(q());
    expect(f.main.steps.map((s) => [s.label, s.count])).toEqual([
      ["Visited", 95],
      ["Started a CV", 35],
      ["Downloaded", 10],
      ["Signed up", 10],
      ["Paid", 2],
    ]);
    expect(f.main.bySource.map((b) => b.value)).toEqual(["(direct)", "google"]);
    expect(f.freeTool.steps.map((s) => s.count)).toEqual([5, 5, 0]);
    expect(f.freeTool.byTool[0]?.value).toBe("ats_checker");
  });

  it("builds acquisition tables, skipping rows without a campaign", async () => {
    const a = await new AnalyticsReportsService(fakeRepo(), () => NOW).acquisition(q({ compare: "1" }));
    expect(a.sources.map((r) => [r.value, r.signupRate])).toEqual([
      ["(direct)", 0.05],
      ["google", 0.1],
    ]);
    expect(a.campaigns).toEqual([]);
    expect(a.landingPages[0]).toMatchObject({ value: "/cv-examples/nurse", kind: "cv_example" });
    expect(a.visitors.new).toEqual({ value: 70, previous: 70, change: 0 });
    expect(a.series).toHaveLength(7);
  });

  it("works out MRR, movements, churn and sales per currency", async () => {
    const r = await new AnalyticsReportsService(fakeRepo(), () => NOW).revenue(q({ compare: "1" }));
    expect(r.currencies.map((c) => c.currency)).toEqual(["usd", "pkr"]);
    const usd = r.currencies[0]!;
    expect(usd.mrr).toEqual({ value: 4000, previous: 3000, change: 1000 / 3000 });
    expect(usd.movements.new).toMatchObject({ value: 1500, previous: 1000 });
    expect(usd.movements.churn.value).toBe(500);
    expect(usd.movements.net.value).toBe(1000);
    expect(usd.churnRate.value).toBeCloseTo(500 / 3000);
    expect(usd.mrrSeries.map((p) => p.value)).toEqual([3000, 4500, 4500, 4000, 4000, 4000, 4000]);
    expect(usd.sales.passes.cents.value).toBe(1800);
    expect(usd.sales.subscriptions.count.value).toBe(1);
    expect(usd.failedPayments.value).toBe(1);
    expect(usd.arppu.value).toBe(900);
    expect(usd.byPlan).toEqual([
      { plan: "premium", interval: "year", subscriptions: 2, mrrCents: 2150 },
      { plan: "standard", interval: "month", subscriptions: 1, mrrCents: 700 },
    ]);
  });

  it("reports usage, stickiness and cohorts", async () => {
    const u = await new AnalyticsReportsService(fakeRepo(), () => NOW).usage(q({ compare: "1" }));
    expect(u.dau).toEqual({ value: 10, previous: 5, change: 1 });
    expect(u.stickiness.value).toBeCloseTo(10 / 50);
    expect(u.features[0]).toMatchObject({ key: "ai", label: "AI writing", users: 12 });
    expect(u.features.length).toBeGreaterThan(10);
    expect(u.cohorts.rows[0]).toMatchObject({ week: "2026-10-12", size: 10 });
    expect(u.cohorts.rows[0]?.cells[1]).toEqual({ users: 3, rate: 0.3 });
    expect(u.cohorts.rows[0]?.cells[2]).toBeNull();
    expect(u.topEvents[0]).toMatchObject({ name: "page_view", label: "Page view" });
  });
});
