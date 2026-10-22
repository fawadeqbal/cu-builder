/** Share-link view analytics: privacy-friendly summaries from individual views. */

export type LinkViewRow = {
  viewedAt: Date;
  /** A daily-rotating hash, so unique viewers are counted without identifying anyone. */
  visitor: string;
  durationMs: number;
  downloaded: boolean;
  referrer: string | null;
  country: string | null;
  device: string | null;
};

export function deviceFromUserAgent(ua: string | undefined): "mobile" | "tablet" | "desktop" | "bot" | null {
  if (!ua) return null;
  if (/bot|crawler|spider|preview|slurp|facebookexternalhit|whatsapp|linkedinbot|slackbot/i.test(ua)) return "bot";
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/mobi|iphone|android/i.test(ua)) return "mobile";
  return "desktop";
}

/** "https://www.linkedin.com/feed/" → "linkedin.com"; empty or same-site → null. */
export function referrerHost(referrer: string | undefined, ownHost?: string): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    return ownHost && host === ownHost.replace(/^www\./, "") ? null : host || null;
  } catch {
    return null;
  }
}

const count = <T extends string>(values: (T | null)[], label: (v: T) => string = (v) => v) => {
  const map = new Map<string, number>();
  for (const v of values) if (v) map.set(label(v), (map.get(label(v)) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
};

export function summariseViews(rows: LinkViewRow[], now: Date = new Date(), days = 30) {
  const views = rows.filter((r) => r.device !== "bot");
  const timed = views.filter((r) => r.durationMs > 0);
  const daily: { date: string; views: number }[] = [];
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)));
  const perDay = new Map<string, number>();
  for (const r of views) {
    const d = r.viewedAt.toISOString().slice(0, 10);
    perDay.set(d, (perDay.get(d) ?? 0) + 1);
  }
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    daily.push({ date: d, views: perDay.get(d) ?? 0 });
  }
  return {
    views: views.length,
    uniqueViewers: new Set(views.map((r) => r.visitor)).size,
    avgSeconds: timed.length ? Math.round(timed.reduce((n, r) => n + r.durationMs, 0) / timed.length / 1000) : 0,
    downloads: views.filter((r) => r.downloaded).length,
    daily,
    referrers: count(views.map((r) => r.referrer)).map(([referrer, n]) => ({ referrer, views: n })),
    countries: count(views.map((r) => r.country)).map(([country, n]) => ({ country, views: n })),
    devices: count(views.map((r) => r.device)).map(([device, n]) => ({ device, views: n })),
  };
}
