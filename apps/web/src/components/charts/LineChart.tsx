"use client";

import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Tooltip, useWidth } from "./ChartFrame";
import { axisFormatterFor, formatBucket, formatterFor, linear, niceTicks, type ValueFormat } from "./format";

export type LineSeries = {
  key: string;
  label: string;
  values: (number | null)[];
  /** A CSS colour, normally a viz token: var(--viz-1), or var(--viz-muted) for the previous period. */
  color: string;
  /** A soft wash under the line (single main series only). */
  area?: boolean;
  /** Context lines (the previous period) are thinner and carry no end marker. */
  context?: boolean;
};

const BASE_M = { top: 12, right: 12, bottom: 26, left: 48 };
/** Room for the longest axis label (11px text, about 6.6px a character), so "−Rs 5,000" isn't cut off. */
const marginsFor = (labels: string[]) => ({ ...BASE_M, left: Math.max(BASE_M.left, Math.ceil(Math.max(0, ...labels.map((l) => l.length)) * 6.6) + 14) });

/**
 * Line or area chart over time with a crosshair: a hairline snaps to the nearest date and one
 * tooltip lists every series there. Arrow keys move it when the chart has focus. Time runs
 * left to right in every language (the plot is LTR; labels around it follow the page).
 */
export function LineChart({
  labels,
  series,
  format = "number",
  currency,
  height = 200,
  label,
  formatLabel = (k) => formatBucket(k, true),
}: {
  /** Bucket keys ("2026-10-23", "2026-10"), one per value. */
  labels: string[];
  series: LineSeries[];
  format?: ValueFormat;
  currency?: string;
  height?: number;
  /** What the chart shows, for screen readers. */
  label: string;
  formatLabel?: (key: string) => string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const gradient = useId();
  const n = labels.length;
  const fmt = formatterFor(format, currency);
  const axisFmt = axisFormatterFor(format, currency);
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const ticks = niceTicks(Math.min(0, ...all), Math.max(0, ...all), 4, format === "number");
  const M = marginsFor(ticks.map((t) => axisFmt(t)));
  const plotW = Math.max(0, width - M.left - M.right);
  const plotH = height - M.top - M.bottom;
  const x = (i: number) => M.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = linear(ticks[0]!, ticks.at(-1)!, M.top + plotH, M.top);
  const xLabelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 72))));

  const path = (values: (number | null)[]) => {
    let d = "";
    let pen = false;
    values.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  const indexAt = (clientX: number, rect: DOMRect) => {
    const px = clientX - rect.left - M.left;
    return Math.max(0, Math.min(n - 1, Math.round(n <= 1 ? 0 : (px / plotW) * (n - 1))));
  };
  const onMove = (e: PointerEvent<SVGRectElement>) => setActive(indexAt(e.clientX, e.currentTarget.ownerSVGElement!.getBoundingClientRect()));
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const next = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (next !== undefined) setActive((a) => Math.max(0, Math.min(n - 1, (a ?? n - 1) + next)));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(n - 1);
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  };

  const main = series.find((s) => !s.context);
  const lastIndex = main ? main.values.findLastIndex((v) => v !== null) : -1;
  const readout =
    active === null
      ? ""
      : `${formatLabel(labels[active] ?? "")}: ${series.map((s) => `${s.label} ${s.values[active] === null || s.values[active] === undefined ? "no data" : fmt(s.values[active]!)}`).join(", ")}`;

  return (
    <div ref={ref} className="relative w-full" style={{ height }} dir="ltr">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${label}. Use the arrow keys to read each date.`}
          tabIndex={0}
          className="block rounded-md outline-none focus-visible:shadow-[var(--focus-ring)]"
          onKeyDown={onKey}
          onFocus={() => setActive((a) => a ?? n - 1)}
          onBlur={() => setActive(null)}
        >
          <defs>
            <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={main?.color ?? "var(--viz-1)"} stopOpacity="0.14" />
              <stop offset="1" stopColor={main?.color ?? "var(--viz-1)"} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={M.left + plotW} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--viz-axis)" : "var(--viz-grid)"} strokeWidth="1" shapeRendering="crispEdges" />
              <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-ink-3 text-[11px] tabular-nums">
                {axisFmt(t)}
              </text>
            </g>
          ))}
          {labels.map((k, i) =>
            i % xLabelEvery === 0 || (i === n - 1 && (n - 1) % xLabelEvery > xLabelEvery / 2) ? (
              <text key={k} x={x(i)} y={height - 8} textAnchor={i === 0 && n > 1 ? "start" : i === n - 1 && n > 1 ? "end" : "middle"} className="fill-ink-3 text-[11px] tabular-nums">
                {formatBucket(k)}
              </text>
            ) : null,
          )}
          {series.map((s) =>
            s.area && !s.context ? (
              <path
                key={`${s.key}-area`}
                d={`${path(s.values)}L${x(Math.max(0, s.values.findLastIndex((v) => v !== null))).toFixed(1)},${y(Math.max(0, ticks[0]!))}L${x(Math.max(0, s.values.findIndex((v) => v !== null)))},${y(Math.max(0, ticks[0]!))}Z`}
                fill={`url(#${gradient})`}
              />
            ) : null,
          )}
          {/* Context lines first, so the main series sits on top. */}
          {[...series].sort((a, b) => Number(Boolean(b.context)) - Number(Boolean(a.context))).map((s) => (
            <path
              key={s.key}
              className="viz-mark"
              d={path(s.values)}
              fill="none"
              stroke={s.color}
              strokeWidth={s.context ? 1.5 : 2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {main && lastIndex >= 0 && active === null && (
            <circle cx={x(lastIndex)} cy={y(main.values[lastIndex]!)} r="4" fill={main.color} stroke="var(--surface)" strokeWidth="2" />
          )}
          {active !== null && (
            <g>
              <line x1={x(active)} x2={x(active)} y1={M.top} y2={M.top + plotH} stroke="var(--viz-axis)" strokeWidth="1" shapeRendering="crispEdges" />
              {series.map((s) =>
                s.values[active] === null || s.values[active] === undefined ? null : (
                  <circle key={s.key} cx={x(active)} cy={y(s.values[active]!)} r="4" fill={s.color} stroke="var(--surface)" strokeWidth="2" />
                ),
              )}
            </g>
          )}
          <rect
            x={M.left}
            y={M.top}
            width={plotW}
            height={plotH}
            fill="transparent"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
      )}
      {active !== null && width > 0 && (
        <Tooltip
          title={formatLabel(labels[active] ?? "")}
          x={x(active)}
          width={width}
          rows={series.map((s) => ({
            label: s.label,
            color: s.color,
            value: s.values[active] === null || s.values[active] === undefined ? "–" : fmt(s.values[active]!),
          }))}
        />
      )}
      <span className="cvb-sr" aria-live="polite">
        {readout}
      </span>
    </div>
  );
}
