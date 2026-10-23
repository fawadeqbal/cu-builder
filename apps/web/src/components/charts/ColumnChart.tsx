"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { Tooltip, useWidth } from "./ChartFrame";
import { axisFormatterFor, formatBucket, formatterFor, linear, niceTicks, type ValueFormat } from "./format";

export type ColumnSeries = {
  key: string;
  label: string;
  /** Non-negative amounts; `negative` series are drawn below the baseline (losses). */
  values: number[];
  color: string;
  negative?: boolean;
};

const BASE_M = { top: 12, right: 12, bottom: 26, left: 48 };
/** Room for the longest axis label (11px text, about 6.6px a character), so "−Rs 5,000" isn't cut off. */
const marginsFor = (labels: string[]) => ({ ...BASE_M, left: Math.max(BASE_M.left, Math.ceil(Math.max(0, ...labels.map((l) => l.length)) * 6.6) + 14) });
const GAP = 2;
const RADIUS = 4;

/** A bar with a rounded data end (top for gains, bottom for losses) and a square baseline end. */
function bar(x: number, y0: number, y1: number, w: number, round: boolean): string {
  const top = Math.min(y0, y1);
  const bottom = Math.max(y0, y1);
  const h = bottom - top;
  if (h <= 0) return "";
  const r = round ? Math.min(RADIUS, w / 2, h) : 0;
  const up = y1 < y0; // grows upwards from y0
  if (!r) return `M${x},${top}h${w}v${h}h${-w}Z`;
  return up
    ? `M${x},${bottom}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${bottom}Z`
    : `M${x},${top}H${x + w}V${bottom - r}Q${x + w},${bottom} ${x + w - r},${bottom}H${x + r}Q${x},${bottom} ${x},${bottom - r}Z`;
}

/**
 * Stacked columns over time, optionally diverging (gains up, losses down from a zero line).
 * Each column is a hover and focus target; the tooltip lists every series in it. Thin columns
 * (at most 24px) with a 2px surface gap between stacked segments.
 */
export function ColumnChart({
  labels,
  series,
  format = "number",
  currency,
  height = 200,
  label,
  formatLabel = (k) => formatBucket(k, true),
}: {
  labels: string[];
  series: ColumnSeries[];
  format?: ValueFormat;
  currency?: string;
  height?: number;
  label: string;
  formatLabel?: (key: string) => string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const n = labels.length;
  const fmt = formatterFor(format, currency);
  const axisFmt = axisFormatterFor(format, currency);
  const up = labels.map((_, i) => series.filter((s) => !s.negative).reduce((t, s) => t + (s.values[i] ?? 0), 0));
  const down = labels.map((_, i) => series.filter((s) => s.negative).reduce((t, s) => t + (s.values[i] ?? 0), 0));
  const ticks = niceTicks(-Math.max(0, ...down), Math.max(0, ...up), 4, format === "number");
  const M = marginsFor(ticks.map((t) => axisFmt(t)));
  const plotW = Math.max(0, width - M.left - M.right);
  const plotH = height - M.top - M.bottom;
  const band = n ? plotW / n : plotW;
  const barW = Math.max(2, Math.min(24, band * 0.6));
  const cx = (i: number) => M.left + band * i + band / 2;
  const y = linear(ticks[0]!, ticks.at(-1)!, M.top + plotH, M.top);
  const xLabelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 72))));

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    setActive(Math.max(0, Math.min(n - 1, Math.floor((e.clientX - rect.left - M.left) / band))));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const next = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (next !== undefined) setActive((a) => Math.max(0, Math.min(n - 1, (a ?? n - 1) + next)));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(n - 1);
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  };

  const stacks = labels.map((_, i) => {
    const segs: { key: string; d: string; color: string }[] = [];
    for (const dir of [false, true]) {
      const list = series.filter((s) => Boolean(s.negative) === dir && (s.values[i] ?? 0) > 0);
      let acc = 0;
      list.forEach((s, j) => {
        const v = s.values[i] ?? 0;
        const from = dir ? -acc : acc;
        const to = dir ? -(acc + v) : acc + v;
        // The surface gap: each segment after the first starts 2px further from the baseline.
        const y0 = y(from) + (j > 0 ? (dir ? GAP : -GAP) : 0);
        const y1 = y(to);
        segs.push({ key: s.key, color: s.color, d: bar(cx(i) - barW / 2, y0, y1, barW, j === list.length - 1) });
        acc += v;
      });
    }
    return segs;
  });

  return (
    <div ref={ref} className="relative w-full" style={{ height }} dir="ltr">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${label}. Use the arrow keys to read each column.`}
          tabIndex={0}
          className="block rounded-md outline-none focus-visible:shadow-[var(--focus-ring)]"
          onKeyDown={onKey}
          onFocus={() => setActive((a) => a ?? n - 1)}
          onBlur={() => setActive(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={M.left + plotW} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--viz-axis)" : "var(--viz-grid)"} strokeWidth="1" shapeRendering="crispEdges" />
              <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-ink-3 text-[11px] tabular-nums">
                {t < 0 ? `−${axisFmt(-t)}` : axisFmt(t)}
              </text>
            </g>
          ))}
          {labels.map((k, i) =>
            i % xLabelEvery === 0 ? (
              <text key={k} x={cx(i)} y={height - 8} textAnchor="middle" className="fill-ink-3 text-[11px] tabular-nums">
                {formatBucket(k)}
              </text>
            ) : null,
          )}
          {active !== null && <rect x={M.left + band * active} y={M.top} width={band} height={plotH} fill="var(--surface-2)" />}
          {stacks.map((segs, i) => (
            <g key={labels[i]} opacity={active === null || active === i ? 1 : 0.75}>
              {segs.map((s) => (s.d ? <path key={s.key} className="viz-mark" d={s.d} fill={s.color} /> : null))}
            </g>
          ))}
          <rect x={M.left} y={M.top} width={plotW} height={plotH} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setActive(null)} />
        </svg>
      )}
      {active !== null && width > 0 && (
        <Tooltip
          title={formatLabel(labels[active] ?? "")}
          x={cx(active)}
          width={width}
          rows={series.map((s) => ({ label: s.label, color: s.color, shape: "rect" as const, value: `${s.negative && (s.values[active] ?? 0) > 0 ? "−" : ""}${fmt(s.values[active] ?? 0)}` }))}
        />
      )}
      <span className="cvb-sr" aria-live="polite">
        {active === null ? "" : `${formatLabel(labels[active] ?? "")}: ${series.map((s) => `${s.label} ${fmt(s.values[active] ?? 0)}`).join(", ")}`}
      </span>
    </div>
  );
}
