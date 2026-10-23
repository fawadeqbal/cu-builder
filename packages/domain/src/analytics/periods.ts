/** Report periods: presets, custom ranges, the period before, and how a series is bucketed. */

export const RANGE_PRESETS = ["7d", "30d", "90d", "12m", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];
export type Bucket = "day" | "week" | "month";

/** A half-open UTC interval [from, to) plus the same-length period right before it. */
export type Period = { from: Date; to: Date; prevFrom: Date; prevTo: Date; bucket: Bucket; days: number };

const DAY = 86_400_000;
export const MAX_RANGE_DAYS = 731;

const startOfUtcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** Parses "2026-10-23" as a UTC date; anything else → null. */
export function parseIsoDate(s: string | undefined | null): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
}

export const bucketFor = (days: number): Bucket => (days <= 92 ? "day" : days <= 190 ? "week" : "month");

/**
 * The period to report on. Presets end today (inclusive); a custom range takes `from` and `to`
 * as inclusive dates. Invalid or reversed custom dates fall back to the last 30 days.
 */
export function resolvePeriod(input: { range: RangePreset; from?: string; to?: string }, now: Date = new Date()): Period {
  const end = new Date(startOfUtcDay(now).getTime() + DAY);
  let from: Date;
  let to = end;
  if (input.range === "custom") {
    const f = parseIsoDate(input.from);
    const t = parseIsoDate(input.to);
    if (f && t && f <= t) {
      from = f;
      to = new Date(Math.min(t.getTime() + DAY, end.getTime()));
      if (to <= from) to = new Date(from.getTime() + DAY);
      if ((to.getTime() - from.getTime()) / DAY > MAX_RANGE_DAYS) from = new Date(to.getTime() - MAX_RANGE_DAYS * DAY);
    } else {
      from = new Date(end.getTime() - 30 * DAY);
    }
  } else if (input.range === "12m") {
    from = new Date(Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth(), end.getUTCDate()));
  } else {
    from = new Date(end.getTime() - Number.parseInt(input.range, 10) * DAY);
  }
  const days = Math.round((to.getTime() - from.getTime()) / DAY);
  const span = to.getTime() - from.getTime();
  return { from, to, prevFrom: new Date(from.getTime() - span), prevTo: from, bucket: bucketFor(days), days };
}

/** Bucket key for a date: "2026-10-23" (day), the Monday "2026-10-19" (ISO week), "2026-10" (month). */
export function bucketKey(d: Date, bucket: Bucket): string {
  if (bucket === "month") return d.toISOString().slice(0, 7);
  if (bucket === "week") {
    const day = startOfUtcDay(d);
    const dow = (day.getUTCDay() + 6) % 7;
    return new Date(day.getTime() - dow * DAY).toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

/** Every bucket key from `from` (inclusive) to `to` (exclusive), in order. */
export function bucketKeys(from: Date, to: Date, bucket: Bucket): string[] {
  const keys: string[] = [];
  let cursor = startOfUtcDay(from);
  while (cursor < to) {
    const k = bucketKey(cursor, bucket);
    if (keys.at(-1) !== k) keys.push(k);
    cursor =
      bucket === "month"
        ? new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
        : bucket === "week"
          ? new Date(parseIsoDate(k)!.getTime() + 7 * DAY)
          : new Date(cursor.getTime() + DAY);
  }
  return keys;
}

export type SeriesPoint = { date: string; value: number; previous: number | null };

/**
 * A complete series for the period: every bucket present (zeros filled in), and when `previous`
 * rows are given, the previous period's value at the same position, so the two lines overlay.
 */
export function alignSeries(
  period: Period,
  current: readonly { key: string; value: number }[],
  previous?: readonly { key: string; value: number }[],
): SeriesPoint[] {
  const cur = new Map(current.map((r) => [r.key, r.value]));
  const keys = bucketKeys(period.from, period.to, period.bucket);
  const prevKeys = previous ? bucketKeys(period.prevFrom, period.prevTo, period.bucket) : [];
  const prev = new Map((previous ?? []).map((r) => [r.key, r.value]));
  // Align from the end so "today" sits over "the same day last period".
  const offset = prevKeys.length - keys.length;
  return keys.map((date, i) => {
    const pk = prevKeys[i + offset];
    return { date, value: cur.get(date) ?? 0, previous: previous ? (pk === undefined ? null : (prev.get(pk) ?? 0)) : null };
  });
}

export type Comparison = { value: number; previous: number | null; change: number | null };

/** A value against the previous period; `change` is relative (0.25 = +25%), null when there's nothing to compare with. */
export function comparison(value: number, previous: number | null | undefined): Comparison {
  if (previous === null || previous === undefined) return { value, previous: null, change: null };
  return { value, previous, change: previous === 0 ? (value === 0 ? 0 : null) : (value - previous) / previous };
}

/** a / b, or 0 when b is 0. */
export const safeRatio = (a: number, b: number): number => (b > 0 ? a / b : 0);
