"use client";

import type { MetricDto, PointDto } from "@cvb/contracts";
import type { ReactNode } from "react";
import { Alert, EmptyState, Skeleton } from "@cvb/ui";
import { formatBucket, MetricTileSkeleton, type LineSeries } from "@/components/charts";

/** Current and previous period of a series, as chart lines (the previous one only when comparing). */
export function periodLines(points: PointDto[], label: string, compare: boolean, area = true): LineSeries[] {
  return [
    { key: "current", label, values: points.map((p) => p.value), color: "var(--viz-1)", area },
    ...(compare ? [{ key: "previous", label: "Previous period", values: points.map((p) => p.previous), color: "var(--viz-muted)", context: true }] : []),
  ];
}

/** The legend for a "this period vs previous" chart (none for a single line: the title names it). */
export const periodLegend = (compare: boolean) =>
  compare
    ? [
        { label: "This period", color: "var(--viz-1)", shape: "line" as const },
        { label: "Previous period", color: "var(--viz-muted)", shape: "line" as const },
      ]
    : undefined;

/** Columns for a series table: date, value, and the previous period when comparing. */
export function seriesTable(points: PointDto[], compare: boolean, fmt: (v: number) => string, name: string) {
  return {
    rows: points,
    columns: [
      { key: "date", label: "Date", render: (p: PointDto) => formatBucket(p.date, true) },
      { key: "value", label: name, numeric: true, render: (p: PointDto) => fmt(p.value) },
      ...(compare ? [{ key: "previous", label: "Previous period", numeric: true, render: (p: PointDto) => (p.previous === null ? "–" : fmt(p.previous)) }] : []),
    ],
    csv: {
      fileName: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      columns: [
        { label: "date", value: (p: PointDto) => p.date },
        { label: "value", value: (p: PointDto) => p.value },
        ...(compare ? [{ label: "previous_period", value: (p: PointDto) => p.previous }] : []),
      ],
    },
  };
}

export const allZero = (points: PointDto[]) => points.every((p) => p.value === 0 && !p.previous);
export const sparkOf = (points: PointDto[]) => points.map((p) => p.value);
export const isEmpty = (m: MetricDto) => m.value === 0 && !m.previous;

export function ReportSkeleton({ tiles = 4 }: { tiles?: number }) {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Loading the report">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: tiles }, (_, i) => (
          <MetricTileSkeleton key={i} />
        ))}
      </div>
      <Skeleton height={260} shape="block" />
      <Skeleton height={180} shape="block" />
    </div>
  );
}

export function ReportError({ error }: { error: Error }) {
  return (
    <Alert tone="danger" title="This report didn't load">
      {error.message}. Try again in a moment.
    </Alert>
  );
}

/** Shown when no events have been recorded at all yet: what the report will hold. */
export function NoEventsYet({ children }: { children: ReactNode }) {
  return (
    <EmptyState icon="bar-chart" title="No analytics events yet">
      {children} Events start arriving as soon as people visit the site (browsers that ask not to be tracked are never counted). For a local preview, load the sample data with{" "}
      <code className="rounded bg-surface-2 px-1 py-0.5 text-[13px]">pnpm db:seed:analytics</code>.
    </EmptyState>
  );
}

/** A grid of tiles that stays two across on phones. */
export function TileGrid({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <div className={`grid grid-cols-2 gap-3 ${wide ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>{children}</div>;
}

export function Section({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {description && <p className="text-sm text-ink-3">{description}</p>}
      </div>
      {children}
    </section>
  );
}
