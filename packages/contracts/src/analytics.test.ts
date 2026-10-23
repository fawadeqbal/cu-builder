import { describe, expect, it } from "vitest";
import { ANALYTICS_EVENT_CATALOG, AnalyticsQuerySchema, CLIENT_EVENTS, TrackSchema, eventLabel } from "./analytics";

describe("analytics contracts", () => {
  it("only lets browsers send client events", () => {
    expect(CLIENT_EVENTS).toContain("page_view");
    expect(CLIENT_EVENTS).not.toContain("signed_up");
    expect(CLIENT_EVENTS).not.toContain("purchase_completed");
    const base = { anonymousId: "anon-12345", events: [{ name: "page_view" }] };
    expect(TrackSchema.safeParse(base).success).toBe(true);
    expect(TrackSchema.safeParse({ ...base, events: [{ name: "signed_up" }] }).success).toBe(false);
  });

  it("caps props and keeps old clients working", () => {
    const props = Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`k${i}`, i]));
    expect(TrackSchema.safeParse({ anonymousId: "anon-12345", events: [{ name: "cv_started", props }] }).success).toBe(false);
    expect(TrackSchema.safeParse({ anonymousId: "anon-12345", events: [{ name: "visit", props: { path: "/" } }] }).success).toBe(true);
  });

  it("parses report queries", () => {
    expect(AnalyticsQuerySchema.parse({})).toMatchObject({ range: "30d", compare: false });
    expect(AnalyticsQuerySchema.parse({ range: "12m", compare: "1", country: "pk", device: "mobile" })).toMatchObject({ compare: true, country: "PK" });
    expect(AnalyticsQuerySchema.safeParse({ device: "watch" }).success).toBe(false);
  });

  it("labels every event", () => {
    for (const name of Object.keys(ANALYTICS_EVENT_CATALOG)) expect(eventLabel(name)).not.toMatch(/_/);
    expect(eventLabel("something_new")).toBe("something new");
  });
});
