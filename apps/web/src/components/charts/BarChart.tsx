"use client";

import { useState } from "react";
import { Legend } from "./ChartFrame";
import { formatterFor, type ValueFormat } from "./format";

export type BarRow = {
  key: string;
  label: string;
  value: number;
  /** The previous period's value, drawn as a thin tick on the track. */
  previous?: number | null;
  /** Extra line for the tooltip ("12 sign-ups · 3 paid"). */
  detail?: string;
};

/**
 * Horizontal bars for comparing categories (sources, features, pages). Plain HTML laid out with
 * logical properties, so it mirrors in right-to-left. One series → one colour, no legend box;
 * the value sits at the bar's tip. Each row is focusable and shows its details on hover or focus.
 */
export function BarChart({
  rows,
  format = "number",
  currency,
  color = "var(--viz-1)",
  label,
  max: maxRows = 10,
}: {
  rows: BarRow[];
  format?: ValueFormat;
  currency?: string;
  color?: string;
  label: string;
  max?: number;
}) {
  const [active, setActive] = useState<string | null>(null);
  const fmt = formatterFor(format, currency);
  const shown = rows.slice(0, maxRows);
  const top = Math.max(1, ...shown.map((r) => Math.max(r.value, r.previous ?? 0)));
  const hasPrevious = shown.some((r) => r.previous !== undefined && r.previous !== null);
  return (
    <div className="flex flex-col gap-3">
      {hasPrevious && (
        <Legend
          items={[
            { label: "This period", color, shape: "rect" },
            { label: "Previous period", color: "var(--viz-muted)", shape: "tick" },
          ]}
        />
      )}
      <ul className="flex flex-col gap-2" aria-label={label}>
        {shown.map((r) => {
          const pct = (r.value / top) * 100;
          const prevPct = r.previous === null || r.previous === undefined ? null : (r.previous / top) * 100;
          const open = active === r.key;
          return (
            <li
              key={r.key}
              tabIndex={0}
              className="group relative grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-center gap-3 rounded-md px-1 py-0.5 outline-none hover:bg-surface-2 focus-visible:shadow-[var(--focus-ring)] sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]"
              onPointerEnter={() => setActive(r.key)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(r.key)}
              onBlur={() => setActive(null)}
              aria-label={`${r.label}: ${fmt(r.value)}${prevPct !== null ? `, previous period ${fmt(r.previous!)}` : ""}${r.detail ? `, ${r.detail}` : ""}`}
            >
              <span className="truncate text-[13px] text-ink-2" title={r.label} dir="auto">
                {r.label}
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <span className="relative h-3 min-w-0 flex-1">
                  <span
                    aria-hidden="true"
                    className="viz-mark absolute inset-y-0 start-0 rounded-e-[4px]"
                    style={{ inlineSize: `${Math.max(pct, r.value > 0 ? 1.5 : 0)}%`, background: color }}
                  />
                  {prevPct !== null && (
                    <span aria-hidden="true" className="absolute -inset-y-0.5 w-0.5 rounded-full bg-[var(--viz-muted)]" style={{ insetInlineStart: `calc(${prevPct}% - 1px)` }} />
                  )}
                </span>
                <span className="cvb-num w-16 shrink-0 text-end text-[13px] font-semibold text-ink">{fmt(r.value)}</span>
              </span>
              {open && (prevPct !== null || r.detail) && (
                <span
                  role="presentation"
                  className="pointer-events-none absolute end-0 top-full z-10 mt-1 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-[var(--shadow-md)]"
                >
                  <span className="block font-semibold text-ink">{r.label}</span>
                  {prevPct !== null && (
                    <span className="block text-ink-3">
                      <span className="cvb-num font-semibold text-ink">{fmt(r.previous!)}</span> previous period
                    </span>
                  )}
                  {r.detail && <span className="block text-ink-3">{r.detail}</span>}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {rows.length > maxRows && <p className="text-xs text-ink-3">Top {maxRows} of {rows.length}; the table has them all.</p>}
    </div>
  );
}
