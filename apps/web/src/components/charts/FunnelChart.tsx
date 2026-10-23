"use client";

import { useState } from "react";
import { Icon } from "@cvb/ui";
import { Legend } from "./ChartFrame";
import { formatCount, formatPercent } from "./format";

export type FunnelStep = { key: string; label: string; count: number; previous: number | null; ofFirst: number; ofPrevious: number; dropOff: number };

const ORDINAL = ["var(--viz-ord-1)", "var(--viz-ord-2)", "var(--viz-ord-3)", "var(--viz-ord-4)", "var(--viz-ord-5)"];

/**
 * A funnel as ordered horizontal bars: one hue stepping lighter down the stages (ordinal), each
 * bar's length against the first step, the share of the first step at the tip, and the drop-off
 * between steps written out. RTL-safe (logical properties); every value is also in the table.
 */
export function FunnelChart({ steps, label }: { steps: FunnelStep[]; label: string }) {
  const [active, setActive] = useState<string | null>(null);
  const first = Math.max(1, steps[0]?.count ?? 0);
  const hasPrevious = steps.some((s) => s.previous !== null);
  return (
    <div className="flex flex-col gap-3">
      {hasPrevious && <Legend items={[{ label: "Previous period", color: "var(--viz-muted)", shape: "tick" }]} />}
      <ol className="flex flex-col" aria-label={label}>
        {steps.map((s, i) => {
          const pct = (s.count / first) * 100;
          const prevPct = s.previous === null ? null : (s.previous / Math.max(1, steps[0]?.previous ?? 0)) * 100;
          return (
            <li key={s.key} className="flex flex-col">
              {i > 0 && (
                <div className="flex items-center gap-1.5 py-1 ps-1 text-xs text-ink-3">
                  <Icon name="arrow-right" size={12} className="rotate-90" />
                  <span>
                    <span className="cvb-num font-semibold text-ink-2">{formatPercent(s.ofPrevious)}</span> continued ·{" "}
                    <span className="cvb-num">{formatPercent(s.dropOff)}</span> dropped off
                  </span>
                </div>
              )}
              <div
                tabIndex={0}
                className="relative grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] items-center gap-3 rounded-md px-1 py-1 outline-none hover:bg-surface-2 focus-visible:shadow-[var(--focus-ring)] sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]"
                onPointerEnter={() => setActive(s.key)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(s.key)}
                onBlur={() => setActive(null)}
                aria-label={`${s.label}: ${formatCount(s.count)} people, ${formatPercent(s.ofFirst)} of the first step${s.previous !== null ? `; previous period ${formatCount(s.previous)}` : ""}`}
              >
                <span className="text-[13px] font-semibold text-ink">{s.label}</span>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="relative h-6 min-w-0 flex-1">
                    <span
                      aria-hidden="true"
                      className="viz-mark absolute inset-y-0 start-0 rounded-e-[4px]"
                      style={{ inlineSize: `${Math.max(pct, s.count > 0 ? 1 : 0)}%`, background: ORDINAL[Math.min(i, ORDINAL.length - 1)] }}
                    />
                    {prevPct !== null && (
                      <span aria-hidden="true" className="absolute -inset-y-1 w-0.5 rounded-full bg-[var(--viz-muted)]" style={{ insetInlineStart: `calc(${Math.min(100, prevPct)}% - 1px)` }} />
                    )}
                  </span>
                  <span className="flex w-24 shrink-0 flex-col items-end leading-4">
                    <span className="cvb-num text-[13px] font-semibold text-ink">{formatCount(s.count)}</span>
                    <span className="cvb-num text-[11px] text-ink-3">{i === 0 ? "entered" : formatPercent(s.ofFirst)}</span>
                  </span>
                </span>
                {active === s.key && s.previous !== null && (
                  <span role="presentation" className="pointer-events-none absolute end-0 top-full z-10 mt-1 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-[var(--shadow-md)]">
                    <span className="cvb-num font-semibold text-ink">{formatCount(s.previous)}</span> <span className="text-ink-3">in the previous period</span>
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
