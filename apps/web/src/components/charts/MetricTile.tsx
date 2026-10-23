"use client";

import { Icon, Skeleton } from "@cvb/ui";
import { formatChange } from "./format";

export type Metric = { value: number; previous: number | null; change: number | null };

/** A tiny trend line: the period in the de-emphasis grey, the latest point in the accent. Decorative (values are in the charts). */
export function Sparkline({ values, height = 28 }: { values: number[]; height?: number }) {
  if (values.length < 2) return null;
  const w = 120;
  const max = Math.max(...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 6) + 3, height - 3 - ((v - min) / span) * (height - 6)] as const);
  const last = pts.at(-1)!;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="block h-7 w-full" aria-hidden="true">
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="var(--viz-muted)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="3" fill="var(--viz-1)" stroke="var(--surface)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * Stat tile: label, value, change against the previous period (coloured by whether that
 * direction is good, always with an arrow and the words) and an optional sparkline.
 */
export function MetricTile({
  label,
  value,
  metric,
  good = "up",
  hint,
  spark,
  formatPrevious,
}: {
  label: string;
  value: string;
  metric?: Metric;
  /** Which direction is good news; "neutral" keeps the delta grey. */
  good?: "up" | "down" | "neutral";
  hint?: string;
  spark?: number[];
  formatPrevious?: (v: number) => string;
}) {
  const change = metric ? formatChange(metric.change) : null;
  const dir = metric && metric.previous !== null ? Math.sign(metric.value - metric.previous) : 0;
  const tone = dir === 0 || good === "neutral" ? "text-ink-3" : (dir > 0) === (good === "up") ? "text-success" : "text-danger";
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-line bg-surface px-4 py-3">
      <span className="cvb-overline truncate text-ink-3">{label}</span>
      <span className="font-display text-[26px] font-[680] leading-8 tracking-[-0.02em] text-ink">{value}</span>
      {metric && metric.previous !== null && (
        <span className={`flex flex-wrap items-center gap-x-1 text-xs font-semibold ${tone}`}>
          {dir !== 0 && <Icon name={dir > 0 ? "chevron-up" : "chevron-down"} size={14} />}
          {change ?? (metric.previous === 0 ? "new" : "no change")}
          <span className="font-normal text-ink-3">
            vs {formatPrevious ? formatPrevious(metric.previous) : metric.previous.toLocaleString("en")} before
          </span>
        </span>
      )}
      {hint && <span className="text-xs text-ink-3">{hint}</span>}
      {spark && (
        <div dir="ltr">
          <Sparkline values={spark} />
        </div>
      )}
    </div>
  );
}

export function MetricTileSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface px-4 py-3" aria-hidden="true">
      <Skeleton width="50%" height={10} />
      <Skeleton width="40%" height={26} />
      <Skeleton width="70%" height={10} />
    </div>
  );
}
