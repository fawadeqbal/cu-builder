"use client";

import { useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Button, DataTable, type Column } from "@cvb/ui";
import { downloadCsv, toCsv, type CsvColumn } from "./csv";

/** Width of an element, kept up to date as it resizes (0 until measured). */
export function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry?.contentRect.width ?? el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

export type LegendItem = { label: string; color: string; shape?: "line" | "rect" | "tick" };

/** The legend mirrors the mark: a short line for lines, a square for bars. Text stays in ink. */
export function Legend({ items, className = "" }: { items: LegendItem[]; className?: string }) {
  if (!items.length) return null;
  return (
    <ul className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2 ${className}`} aria-label="Legend">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1.5">
          <Swatch color={i.color} shape={i.shape ?? "rect"} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

export function Swatch({ color, shape }: { color: string; shape: "line" | "rect" | "tick" }) {
  if (shape === "line") return <span aria-hidden="true" className="inline-block h-0.5 w-3.5 rounded-full" style={{ background: color }} />;
  if (shape === "tick") return <span aria-hidden="true" className="inline-block h-3 w-0.5 rounded-full" style={{ background: color }} />;
  return <span aria-hidden="true" className="inline-block size-2.5 rounded-[3px]" style={{ background: color }} />;
}

export type TooltipRow = { label: string; value: string; color?: string; shape?: "line" | "rect" | "tick" };

/**
 * One tooltip for a chart: values lead (strong), labels follow. Positioned inside the chart's
 * box at `x` (px from the start of the plot), flipping to stay inside the frame.
 */
export function Tooltip({ title, rows, x, width, top = 4 }: { title: string; rows: TooltipRow[]; x: number; width: number; top?: number }) {
  const flip = x > width * 0.6;
  return (
    <div
      role="presentation"
      className="pointer-events-none absolute z-10 min-w-36 max-w-60 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-[var(--shadow-md)]"
      style={{ top, left: flip ? undefined : Math.min(x + 12, Math.max(0, width - 150)), right: flip ? Math.max(0, width - x + 12) : undefined }}
      dir="auto"
    >
      <div className="mb-1 font-semibold text-ink-3">{title}</div>
      <ul className="flex flex-col gap-1">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2">
            {r.color && <Swatch color={r.color} shape={r.shape ?? "line"} />}
            <span className="cvb-num font-semibold text-ink">{r.value}</span>
            <span className="truncate text-ink-3">{r.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type ChartTable<R> = {
  rows: R[];
  columns: Column<R>[];
  csv: { fileName: string; columns: CsvColumn<R>[] };
  /** Show the table straight away (breakdowns) instead of behind "Table view" (time series). */
  open?: boolean;
};

/**
 * A chart's card: title, optional description and legend, the chart, and its table twin with a
 * CSV download. While new data loads the previous render stays, dimmed, so nothing jumps.
 */
export function ChartFrame<R>({
  title,
  description,
  legend,
  table,
  empty,
  refreshing,
  actions,
  children,
}: {
  title: string;
  description?: ReactNode;
  legend?: LegendItem[];
  table?: ChartTable<R>;
  /** When set, shown instead of the chart: what will appear here once data arrives. */
  empty?: ReactNode;
  refreshing?: boolean;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(Boolean(table?.open));
  const id = `chart-${useId().replace(/:/g, "")}`;
  return (
    <figure className="flex min-w-0 flex-col gap-3 rounded-xl border border-line bg-surface p-4 sm:p-5" aria-labelledby={`${id}-title`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 id={`${id}-title`} className="text-[15px] font-semibold leading-5 text-ink">
            {title}
          </h3>
          {description && <p className="text-[13px] leading-5 text-ink-3">{description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {table && !empty && (
            <Button
              size="sm"
              variant="ghost"
              icon="download"
              onClick={() => downloadCsv(table.csv.fileName, toCsv(table.rows, table.csv.columns))}
              aria-label={`Download ${title} as CSV`}
            >
              CSV
            </Button>
          )}
        </div>
      </div>
      {legend && !empty && <Legend items={legend} />}
      {(empty || children) && (
        <div className={`min-w-0 transition-opacity ${refreshing ? "opacity-60" : ""}`} aria-busy={refreshing || undefined}>
          {empty ? <div className="rounded-lg bg-surface-2 px-4 py-8 text-center text-sm leading-6 text-ink-3">{empty}</div> : children}
        </div>
      )}
      {table && !empty && (
        <div className="flex flex-col gap-2">
          {!table.open && (
            <button
              type="button"
              className="self-start text-[13px] font-semibold text-brand-ink underline-offset-4 hover:underline"
              aria-expanded={open}
              aria-controls={`${id}-table`}
              onClick={() => setOpen((o) => !o)}
            >
              {open ? "Hide table" : "Table view"}
            </button>
          )}
          {open && (
            <div id={`${id}-table`} className={`max-h-[28rem] overflow-auto transition-opacity ${refreshing ? "opacity-60" : ""}`}>
              <DataTable<R> caption={title} rows={table.rows} columns={table.columns} />
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
