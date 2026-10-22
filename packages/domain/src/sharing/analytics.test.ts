import { describe, expect, it } from "vitest";
import { deviceFromUserAgent, referrerHost, summariseViews } from "./analytics";

describe("share-link analytics", () => {
  it("classifies devices and referrers", () => {
    expect(deviceFromUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile")).toBe("mobile");
    expect(deviceFromUserAgent("LinkedInBot/1.0")).toBe("bot");
    expect(deviceFromUserAgent("Mozilla/5.0 (Windows NT 10.0)")).toBe("desktop");
    expect(referrerHost("https://www.linkedin.com/feed/")).toBe("linkedin.com");
    expect(referrerHost("https://cv.example.com/app", "cv.example.com")).toBeNull();
    expect(referrerHost("not a url")).toBeNull();
  });

  it("summarises views, ignoring bots", () => {
    const now = new Date("2026-10-22T12:00:00Z");
    const row = (o: Partial<Parameters<typeof summariseViews>[0][number]>) => ({
      viewedAt: now,
      visitor: "a",
      durationMs: 0,
      downloaded: false,
      referrer: null,
      country: null,
      device: "desktop",
      ...o,
    });
    const s = summariseViews(
      [
        row({ visitor: "a", durationMs: 30_000, referrer: "linkedin.com", country: "PK" }),
        row({ visitor: "a", durationMs: 10_000, downloaded: true }),
        row({ visitor: "b", referrer: "linkedin.com", viewedAt: new Date("2026-10-20T08:00:00Z") }),
        row({ visitor: "bot", device: "bot" }),
      ],
      now,
    );
    expect(s).toMatchObject({ views: 3, uniqueViewers: 2, avgSeconds: 20, downloads: 1 });
    expect(s.daily).toHaveLength(30);
    expect(s.daily.at(-1)).toEqual({ date: "2026-10-22", views: 2 });
    expect(s.referrers).toEqual([{ referrer: "linkedin.com", views: 2 }]);
  });
});
