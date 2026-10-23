/** Number formatting and scales shared by the charts. Pure functions, so they're easy to test. */

export type ValueFormat = "number" | "percent" | "money" | "decimal";
export type Formatter = (v: number) => string;

const compactNf = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const nf = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
const dec = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });
const pct = new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 1 });

/** 1,284 · 12.9K · 4.2M (compact from 10,000 up so small counts stay exact). */
export const formatCount: Formatter = (v) => (Math.abs(v) >= 10_000 ? compactNf.format(v) : nf.format(v));
export const formatDecimal: Formatter = (v) => dec.format(v);
export const formatPercent: Formatter = (v) => pct.format(v);

/** Minor units → "$1,234", "Rs 99,000" (whole units from 100 up, so tiles stay short). */
export function formatMoney(cents: number, currency: string, compact = false): string {
  const major = cents / 100;
  if (compact && Math.abs(major) >= 10_000) {
    return `${currency === "pkr" ? "Rs " : "$"}${compactNf.format(major)}`;
  }
  const text = new Intl.NumberFormat("en", { maximumFractionDigits: Math.abs(major) >= 100 || Number.isInteger(major) ? 0 : 2, minimumFractionDigits: 0 }).format(major);
  return currency === "pkr" ? `Rs ${text}` : `$${text}`;
}

export const formatterFor = (format: ValueFormat, currency = "usd"): Formatter =>
  format === "percent" ? formatPercent : format === "money" ? (v) => formatMoney(v, currency) : format === "decimal" ? formatDecimal : formatCount;

/** Short axis label: 0 · 2K · 1.5M · 40% · $2K. */
export const axisFormatterFor = (format: ValueFormat, currency = "usd"): Formatter =>
  format === "percent"
    ? (v) => `${Math.round(v * 100)}%`
    : format === "money"
      ? (v) => formatMoney(v, currency, true)
      : (v) => (Math.abs(v) >= 1000 ? compactNf.format(v) : formatDecimal(v));

/** "Up to `max`" in 3–5 clean steps (1, 2, 2.5, 5 × 10ⁿ). Always at least [0, 1]. */
export function niceTicks(min: number, max: number, count = 4, integer = false): number[] {
  const lo = Math.min(0, min);
  // All zero (or no data): a 0–1 axis rather than a degenerate one.
  const hi = max > lo ? max : lo + 1;
  const span = hi - lo || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const found = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count && (!integer || Number.isInteger(s))) ?? 10 * mag;
  const step = integer ? Math.max(1, Math.round(found)) : found;
  const start = Math.floor(lo / step) * step;
  const ticks: number[] = [];
  for (let t = start; t <= hi + step * 0.999; t += step) ticks.push(Number(t.toFixed(10)));
  if (ticks.length < 2) ticks.push(step);
  return ticks;
}

/** A linear scale from a domain to a range. */
export const linear = (d0: number, d1: number, r0: number, r1: number) => (v: number) => (d1 === d0 ? r0 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0));

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-23" → "23 Oct"; "2026-10" → "Oct 2026"; with `long`, "23 Oct 2026". */
export function formatBucket(key: string, long = false): string {
  const [y, m, d] = key.split("-");
  const month = MONTHS[Number(m) - 1] ?? m ?? "";
  if (!d) return `${month} ${y}`;
  return long ? `${Number(d)} ${month} ${y}` : `${Number(d)} ${month}`;
}

/** Signed relative change: "+12.5%", "−3%", "0%". Null when there's nothing to compare. */
export function formatChange(change: number | null): string | null {
  if (change === null || !Number.isFinite(change)) return null;
  const sign = change > 0 ? "+" : change < 0 ? "−" : "";
  return `${sign}${pct.format(Math.abs(change))}`;
}

/** Text colour for a label set inside a filled cell: dark ink on light fills, white on dark ones. */
export function inkOn(hex: string): "#1a1a1a" | "#ffffff" {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#1a1a1a";
  const n = Number.parseInt(m[1]!, 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  // Pick whichever contrasts more.
  return (L + 0.05) / 0.05 > 1.05 / (L + 0.05) ? "#1a1a1a" : "#ffffff";
}
