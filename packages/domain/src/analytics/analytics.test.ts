import { describe, expect, it } from "vitest";
import {
  alignSeries,
  arppu,
  browserFamily,
  bucketKey,
  bucketKeys,
  buildCohorts,
  averageRetention,
  channelOf,
  comparison,
  deviceClass,
  funnel,
  funnelBreakdown,
  isBot,
  listPrice,
  monthlyCents,
  mrrMovement,
  mrrMovements,
  nextSession,
  normalisePath,
  pageKind,
  resolveCountry,
  resolvePeriod,
  revenueChurnRate,
  subscriptionMrr,
  summariseMovements,
  touchFromUrl,
  type MrrSubscription,
} from "./index";

const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID_TABLET = "Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
const EDGE = `${CHROME_MAC} Edg/129.0.0.0`;

describe("attribution", () => {
  it("reads UTM tags, the referring domain and the landing path", () => {
    const t = touchFromUrl(
      "https://cv.example.com/cv-examples/nurse/?utm_source=Facebook&utm_medium=cpc&utm_campaign=launch&ref=x",
      "https://www.facebook.com/some/post?id=1",
    );
    expect(t).toEqual({ source: "facebook", medium: "cpc", campaign: "launch", referrer: "facebook.com", landing: "/cv-examples/nurse" });
  });

  it("ignores its own site as a referrer", () => {
    expect(touchFromUrl("https://cv.example.com/pricing", "https://cv.example.com/").referrer).toBeUndefined();
  });

  it("classifies channels", () => {
    expect(channelOf({ source: "newsletter" })).toEqual({ source: "newsletter", medium: "(none)" });
    expect(channelOf({ referrer: "google.com" })).toEqual({ source: "google", medium: "organic" });
    expect(channelOf({ referrer: "google.com.pk" })).toEqual({ source: "google", medium: "organic" });
    expect(channelOf({ referrer: "lnkd.in" })).toEqual({ source: "linkedin", medium: "social" });
    expect(channelOf({ referrer: "linkedin.com" })).toEqual({ source: "linkedin", medium: "social" });
    expect(channelOf({ referrer: "rozee.pk" })).toEqual({ source: "rozee.pk", medium: "referral" });
    expect(channelOf({})).toEqual({ source: "(direct)", medium: "(none)" });
    expect(channelOf(undefined)).toEqual({ source: "(direct)", medium: "(none)" });
  });

  it("strips ids, secrets and queries from paths", () => {
    expect(normalisePath("/r/abc123secret?x=1")).toBe("/r/:slug");
    expect(normalisePath("/edit/cmh1abcdefghijklmnop12")).toBe("/edit/:id");
    expect(normalisePath("/org/new")).toBe("/org/new");
    expect(normalisePath("/org/cmh1abcdefghijk/branding")).toBe("/org/:id/branding");
    expect(normalisePath("/cv-examples/software-engineer/")).toBe("/cv-examples/software-engineer");
    expect(normalisePath("/Tools//summary-generator#top")).toBe("/Tools/summary-generator");
    expect(normalisePath("/something/ckz9x8y7w6v5u4t3s2r1q0")).toBe("/something/:id");
    expect(normalisePath("")).toBe("/");
  });

  it("names page kinds", () => {
    expect(pageKind("/")).toBe("home");
    expect(pageKind("/cv-examples/nurse")).toBe("cv_example");
    expect(pageKind("/ats-checker")).toBe("free_tool");
    expect(pageKind("/tools/bullet-improver")).toBe("free_tool");
    expect(pageKind("/edit/:id")).toBe("app");
    expect(pageKind("/sign-up")).toBe("auth");
  });
});

describe("sessions", () => {
  const ids = (() => {
    let n = 0;
    return () => `s${++n}`;
  })();

  it("keeps a session alive and ends it after 30 idle minutes", () => {
    const a = nextSession(null, 0, { landing: "/" }, ids);
    expect(a.started).toBe(true);
    const b = nextSession(a.session, 29 * 60_000, { landing: "/pricing" }, ids);
    expect(b.started).toBe(false);
    expect(b.session.id).toBe(a.session.id);
    const c = nextSession(b.session, 29 * 60_000 + 31 * 60_000, { landing: "/" }, ids);
    expect(c.started).toBe(true);
    expect(c.session.id).not.toBe(a.session.id);
  });

  it("starts a new session when a different campaign arrives", () => {
    const a = nextSession(null, 0, { source: "google", medium: "cpc", landing: "/" }, ids);
    const same = nextSession(a.session, 1000, { source: "google", medium: "cpc", landing: "/x" }, ids);
    expect(same.started).toBe(false);
    const other = nextSession(same.session, 2000, { source: "newsletter", landing: "/" }, ids);
    expect(other.started).toBe(true);
    expect(other.session.touch.source).toBe("newsletter");
  });

  it("keeps the session's attribution from its first page", () => {
    const a = nextSession(null, 0, { referrer: "linkedin.com", landing: "/" }, ids);
    const b = nextSession(a.session, 1000, { landing: "/pricing" }, ids);
    expect(b.session.touch).toEqual({ referrer: "linkedin.com", landing: "/" });
  });
});

describe("user agents and countries", () => {
  it("drops bots and scripts", () => {
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true);
    expect(isBot("curl/8.4.0")).toBe(true);
    expect(isBot(`${CHROME_MAC} HeadlessChrome`)).toBe(true);
    expect(isBot(undefined)).toBe(true);
    expect(isBot(CHROME_MAC)).toBe(false);
    expect(isBot(SAFARI_IPHONE)).toBe(false);
  });

  it("classifies devices and browser families coarsely", () => {
    expect(deviceClass(SAFARI_IPHONE)).toBe("mobile");
    expect(deviceClass(ANDROID_TABLET)).toBe("tablet");
    expect(deviceClass(CHROME_MAC)).toBe("desktop");
    expect(browserFamily(CHROME_MAC)).toBe("Chrome");
    expect(browserFamily(SAFARI_IPHONE)).toBe("Safari");
    expect(browserFamily(EDGE)).toBe("Edge");
    expect(browserFamily("Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0")).toBe("Firefox");
  });

  it("prefers a proxy country header over the time-zone guess", () => {
    expect(resolveCountry({ "cf-ipcountry": "pk" }, "GB")).toBe("PK");
    expect(resolveCountry({ "cf-ipcountry": "XX", "x-vercel-ip-country": "AE" }, "GB")).toBe("AE");
    expect(resolveCountry({ "cf-ipcountry": "T1" }, "GB")).toBe("GB");
    expect(resolveCountry({}, undefined)).toBeUndefined();
  });
});

describe("periods", () => {
  const now = new Date("2026-10-23T15:00:00Z");

  it("resolves presets ending today, with the same-length period before", () => {
    const p = resolvePeriod({ range: "7d" }, now);
    expect(p.from.toISOString()).toBe("2026-10-17T00:00:00.000Z");
    expect(p.to.toISOString()).toBe("2026-10-24T00:00:00.000Z");
    expect(p.prevFrom.toISOString()).toBe("2026-10-10T00:00:00.000Z");
    expect(p.prevTo.toISOString()).toBe(p.from.toISOString());
    expect(p.bucket).toBe("day");
    expect(p.days).toBe(7);
    expect(resolvePeriod({ range: "12m" }, now).bucket).toBe("month");
  });

  it("takes inclusive custom dates and falls back on bad ones", () => {
    const p = resolvePeriod({ range: "custom", from: "2026-09-01", to: "2026-09-30" }, now);
    expect(p.days).toBe(30);
    expect(p.to.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(resolvePeriod({ range: "custom", from: "2026-09-30", to: "2026-09-01" }, now).days).toBe(30);
    expect(resolvePeriod({ range: "custom", from: "2026-02-31", to: "2026-03-01" }, now).days).toBe(30);
  });

  it("buckets by day, ISO week and month", () => {
    const d = new Date("2026-10-23T10:00:00Z"); // a Friday
    expect(bucketKey(d, "day")).toBe("2026-10-23");
    expect(bucketKey(d, "week")).toBe("2026-10-19");
    expect(bucketKey(d, "month")).toBe("2026-10");
    expect(bucketKeys(new Date("2026-01-15T00:00:00Z"), new Date("2026-04-02T00:00:00Z"), "month")).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
    ]);
  });

  it("aligns the previous period under the current one and fills gaps", () => {
    const p = resolvePeriod({ range: "7d" }, now);
    const s = alignSeries(p, [{ key: "2026-10-23", value: 5 }], [{ key: "2026-10-16", value: 3 }]);
    expect(s).toHaveLength(7);
    expect(s.at(-1)).toEqual({ date: "2026-10-23", value: 5, previous: 3 });
    expect(s[0]).toEqual({ date: "2026-10-17", value: 0, previous: 0 });
    expect(alignSeries(p, [])[0]?.previous).toBeNull();
  });

  it("compares with the previous period", () => {
    expect(comparison(15, 10)).toEqual({ value: 15, previous: 10, change: 0.5 });
    expect(comparison(3, 0)).toEqual({ value: 3, previous: 0, change: null });
    expect(comparison(0, 0).change).toBe(0);
    expect(comparison(4, null)).toEqual({ value: 4, previous: null, change: null });
  });
});

describe("funnels", () => {
  const keys = ["visited", "started", "downloaded", "signed_up", "paid"];
  const groups = [
    { steps: [true, false, false, false, false], count: 60 },
    { steps: [true, true, false, false, false], count: 20 },
    { steps: [true, true, true, false, false], count: 5 },
    { steps: [true, true, true, true, false], count: 10 },
    { steps: [true, true, true, true, true], count: 5 },
    // Signed up without downloading: a closed funnel stops them at "started".
    { steps: [true, true, false, true, false], count: 7 },
  ];

  it("counts people who reached each step and every step before it", () => {
    const f = funnel(keys, groups);
    expect(f.map((s) => s.count)).toEqual([107, 47, 20, 15, 5]);
    expect(f[1]!.ofFirst).toBeCloseTo(47 / 107);
    expect(f[2]!.ofPrevious).toBeCloseTo(20 / 47);
    expect(f[2]!.dropOff).toBeCloseTo(27 / 47);
    expect(f[0]!.dropOff).toBe(0);
  });

  it("handles an empty funnel", () => {
    expect(funnel(keys, []).every((s) => s.count === 0 && s.ofFirst === 0)).toBe(true);
  });

  it("breaks down by a dimension and folds the tail into Other", () => {
    const rows = funnelBreakdown(
      ["visited", "paid"],
      [
        { dim: "google", steps: [true, true], count: 4 },
        { dim: "google", steps: [true, false], count: 6 },
        { dim: "linkedin", steps: [true, false], count: 8 },
        { dim: "x", steps: [true, false], count: 1 },
        { dim: "y", steps: [true, true], count: 1 },
      ],
      2,
    );
    expect(rows.map((r) => r.value)).toEqual(["google", "linkedin", "Other"]);
    expect(rows[0]!.steps[1]!.count).toBe(4);
    expect(rows[2]!.steps.map((s) => s.count)).toEqual([2, 1]);
  });
});

describe("cohorts", () => {
  it("builds rates per week since sign-up and leaves future weeks empty", () => {
    const rows = buildCohorts({
      cohorts: [
        { week: "2026-10-12", size: 10 },
        { week: "2026-09-28", size: 20 },
      ],
      activity: [
        { week: "2026-09-28", offset: 0, users: 18 },
        { week: "2026-09-28", offset: 1, users: 10 },
        { week: "2026-09-28", offset: 3, users: 5 },
        { week: "2026-10-12", offset: 1, users: 4 },
      ],
      weeks: 4,
      now: new Date("2026-10-23T00:00:00Z"),
    });
    expect(rows.map((r) => r.week)).toEqual(["2026-09-28", "2026-10-12"]);
    expect(rows[0]!.cells.map((c) => c?.rate ?? null)).toEqual([1, 0.5, 0, 0.25, null]);
    expect(rows[1]!.cells.map((c) => c?.users ?? null)).toEqual([10, 4, null, null, null]);
    expect(averageRetention(rows, 4)).toEqual([1, 14 / 30, 0, 0.25, null]);
  });
});

describe("MRR", () => {
  const sub = (o: Partial<MrrSubscription> = {}): MrrSubscription => ({
    status: "active",
    amountCents: 1500,
    interval: "month",
    plan: "premium",
    currency: "usd",
    ...o,
  });

  it("normalises yearly plans to a monthly amount", () => {
    expect(monthlyCents(12_900, "year")).toBe(1075);
    expect(monthlyCents(1500, "month")).toBe(1500);
    expect(subscriptionMrr(sub({ amountCents: 12_900, interval: "year" }))).toBe(1075);
  });

  it("counts only paying states, and falls back to list prices", () => {
    expect(subscriptionMrr(sub({ status: "trialing" }))).toBe(0);
    expect(subscriptionMrr(sub({ status: "past_due" }))).toBe(1500);
    expect(subscriptionMrr(sub({ status: "canceled" }))).toBe(0);
    expect(subscriptionMrr(sub({ amountCents: null, currency: "pkr" }))).toBe(listPrice("premium", "month", "pkr"));
  });

  it("classifies movements", () => {
    expect(mrrMovement(null, sub())?.kind).toBe("new");
    expect(mrrMovement(sub({ status: "trialing" }), sub())?.kind).toBe("new");
    expect(mrrMovement(sub(), sub({ amountCents: 3900, plan: "executive" }))).toEqual({
      kind: "expansion",
      beforeCents: 1500,
      afterCents: 3900,
      deltaCents: 2400,
    });
    expect(mrrMovement(sub(), sub({ amountCents: 700 }))?.kind).toBe("contraction");
    expect(mrrMovement(sub(), sub({ status: "canceled" }))?.kind).toBe("churn");
    expect(mrrMovement(sub({ status: "canceled" }), sub())?.kind).toBe("reactivation");
    expect(mrrMovement(sub(), sub())).toBeNull();
  });

  it("splits a currency change into churn and new", () => {
    const m = mrrMovements(sub(), sub({ currency: "pkr", amountCents: 199_000 }));
    expect(m.map((x) => [x.kind, x.currency, x.deltaCents])).toEqual([
      ["churn", "usd", -1500],
      ["new", "pkr", 199_000],
    ]);
  });

  it("summarises movements, churn rate and ARPPU", () => {
    const s = summariseMovements([
      { kind: "new", deltaCents: 1500 },
      { kind: "churn", deltaCents: -700 },
      { kind: "expansion", deltaCents: 800 },
    ]);
    expect(s).toMatchObject({ new: 1500, churn: 700, expansion: 800, net: 1600 });
    expect(revenueChurnRate(10_000, 700)).toBeCloseTo(0.07);
    expect(revenueChurnRate(0, 700)).toBeNull();
    expect(arppu(10_000, 3)).toBe(3333);
    expect(arppu(10_000, 0)).toBe(0);
  });
});

describe("import formats", () => {
  it("names the format from the type or the extension", async () => {
    const { importFormat } = await import("./formats");
    expect(importFormat("application/pdf")).toBe("pdf");
    expect(importFormat("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("docx");
    expect(importFormat("application/x-linkedin-export+zip")).toBe("linkedin");
    expect(importFormat("", "cv.RTF")).toBe("rtf");
    expect(importFormat("application/octet-stream", "x.bin")).toBe("other");
  });
});
