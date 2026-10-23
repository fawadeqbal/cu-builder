import type { TrackDto } from "@cvb/contracts";
import { describe, expect, it } from "vitest";
import { AnalyticsService, type RequestFacts } from "./analytics.service.js";
import { InMemoryAnalyticsEventsRepository } from "./in-memory-analytics-events.repository.js";

const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const req = (o: Partial<RequestFacts> = {}): RequestFacts => ({ userId: null, userAgent: CHROME, headers: {}, ...o });
const dto = (o: Partial<TrackDto> = {}): TrackDto => ({
  anonymousId: "anon-1234",
  sessionId: "sess-1234",
  context: {
    locale: "en",
    currency: "pkr",
    tzCountry: "PK",
    first: { source: "facebook", medium: "cpc", campaign: "launch", landing: "/cv-examples/nurse" },
    last: { referrer: "google.com", landing: "/pricing" },
  },
  events: [{ name: "page_view", path: "/edit/cmh1abcdefghijklmnop12?x=1" }],
  ...o,
});

function setup() {
  const repo = new InMemoryAnalyticsEventsRepository();
  return { repo, service: new AnalyticsService(repo) };
}

describe("AnalyticsService.track", () => {
  it("stores events with session attribution, coarse device facts and a normalised path", async () => {
    const { repo, service } = setup();
    expect(await service.track(dto(), req({ userAgent: IPHONE, headers: { "cf-ipcountry": "AE" } }))).toBe(1);
    expect(repo.events[0]).toMatchObject({
      name: "page_view",
      anonymousId: "anon-1234",
      sessionId: "sess-1234",
      path: "/edit/:id",
      referrerDomain: "google.com",
      utmSource: null,
      device: "mobile",
      browser: "Safari",
      country: "AE",
      locale: "en",
      currency: "pkr",
    });
    expect(repo.visitors.get("anon-1234")).toMatchObject({ source: "facebook", medium: "cpc", campaign: "launch", landingPath: "/cv-examples/nurse", country: "AE" });
  });

  it("falls back to the time-zone country and classifies a referrer-only first touch", async () => {
    const { repo, service } = setup();
    await service.track(dto({ context: { tzCountry: "PK", last: { referrer: "lnkd.in" } } }), req());
    expect(repo.events[0]?.country).toBe("PK");
    expect(repo.visitors.get("anon-1234")).toMatchObject({ source: "linkedin", medium: "social", referrerDomain: "lnkd.in" });
  });

  it("drops bots and browsers that ask not to be tracked", async () => {
    const { repo, service } = setup();
    expect(await service.track(dto(), req({ userAgent: "Googlebot/2.1 (+http://www.google.com/bot.html)" }))).toBe(0);
    expect(await service.track(dto(), req({ userAgent: undefined }))).toBe(0);
    expect(await service.track(dto(), req({ headers: { dnt: "1" } }))).toBe(0);
    expect(await service.track(dto(), req({ headers: { "sec-gpc": "1" } }))).toBe(0);
    expect(repo.events).toHaveLength(0);
    expect(repo.visitors.size).toBe(0);
  });

  it("links the browser to the account at sign-up and stores first-touch attribution once", async () => {
    const { repo, service } = setup();
    const t0 = new Date("2026-10-01T10:00:00Z");
    await service.track(dto(), req(), t0);
    repo.accounts.set("u1", { createdAt: new Date("2026-10-01T10:05:00Z"), acquisition: null });
    await service.track(dto({ events: [{ name: "cv_started", props: { source: "blank" } }] }), req({ userId: "u1" }), new Date("2026-10-01T10:06:00Z"));
    expect(repo.visitors.get("anon-1234")?.userId).toBe("u1");
    expect(repo.accounts.get("u1")?.acquisition).toMatchObject({
      source: "facebook",
      medium: "cpc",
      campaign: "launch",
      landing: "/cv-examples/nurse",
      device: "desktop",
      firstSeenAt: t0.toISOString(),
    });

    // A later sign-in on the same browser by someone else doesn't move the link.
    repo.accounts.set("u2", { createdAt: new Date("2026-09-01T00:00:00Z"), acquisition: null });
    await service.track(dto(), req({ userId: "u2" }), new Date("2026-10-02T00:00:00Z"));
    expect(repo.visitors.get("anon-1234")?.userId).toBe("u1");
    expect(repo.accounts.get("u2")?.acquisition).toBeNull();
  });

  it("doesn't credit an old account to a browser first seen long after it signed up", async () => {
    const { repo, service } = setup();
    repo.accounts.set("u1", { createdAt: new Date("2026-01-01T00:00:00Z"), acquisition: null });
    await service.track(dto({ anonymousId: "new-device-1" }), req({ userId: "u1" }), new Date("2026-10-01T00:00:00Z"));
    expect(repo.visitors.get("new-device-1")?.userId).toBe("u1");
    expect(repo.accounts.get("u1")?.acquisition).toBeNull();
  });
});

describe("AnalyticsService.record", () => {
  it("writes server-side events under the account's server id and never throws", async () => {
    const { repo, service } = setup();
    await service.record("purchase_completed", { userId: "u1", currency: "usd", props: { offer: "pass_7d" } });
    expect(repo.events[0]).toMatchObject({ name: "purchase_completed", anonymousId: "u:u1", userId: "u1", currency: "usd", props: { offer: "pass_7d" } });
    repo.insertEvents = async () => {
      throw new Error("db down");
    };
    await expect(service.record("payment_failed", { userId: "u1" })).resolves.toBeUndefined();
  });
});
