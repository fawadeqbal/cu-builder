"use client";

import type { AnalyticsFunnelDto, FunnelStepDto } from "@cvb/contracts";
import { ChartFrame, formatCount, formatPercent, FunnelChart } from "@/components/charts";
import { NoEventsYet, ReportError, ReportSkeleton, Section } from "./shared";
import { useReport, type Filters } from "./state";

type Breakdown = AnalyticsFunnelDto["main"]["bySource"];

const TOOL_LABEL: Record<string, string> = {
  ats_checker: "ATS checker",
  summary_generator: "Summary generator",
  bullet_improver: "Bullet improver",
  "(unknown)": "(unknown)",
  Other: "Other",
};

function stepsTable(steps: FunnelStepDto[], compare: boolean, name: string) {
  return {
    open: true,
    rows: steps,
    columns: [
      { key: "label", label: "Step", render: (s: FunnelStepDto) => s.label },
      { key: "count", label: "People", numeric: true, render: (s: FunnelStepDto) => formatCount(s.count) },
      { key: "ofFirst", label: "Of first step", numeric: true, render: (s: FunnelStepDto) => formatPercent(s.ofFirst) },
      { key: "ofPrevious", label: "Of step before", numeric: true, render: (s: FunnelStepDto) => formatPercent(s.ofPrevious) },
      { key: "dropOff", label: "Dropped off", numeric: true, render: (s: FunnelStepDto) => formatPercent(s.dropOff) },
      ...(compare ? [{ key: "previous", label: "Previous period", numeric: true, render: (s: FunnelStepDto) => (s.previous === null ? "–" : formatCount(s.previous)) }] : []),
    ],
    csv: {
      fileName: name,
      columns: [
        { label: "step", value: (s: FunnelStepDto) => s.key },
        { label: "people", value: (s: FunnelStepDto) => s.count },
        { label: "share_of_first", value: (s: FunnelStepDto) => s.ofFirst.toFixed(4) },
        { label: "share_of_previous", value: (s: FunnelStepDto) => s.ofPrevious.toFixed(4) },
        { label: "drop_off", value: (s: FunnelStepDto) => s.dropOff.toFixed(4) },
        ...(compare ? [{ label: "previous_period", value: (s: FunnelStepDto) => s.previous }] : []),
      ],
    },
  };
}

/** A breakdown as a table: one row per value, people at each step and the end-to-end rate. */
function BreakdownTable({ title, description, rows, dim, label = (v: string) => v }: { title: string; description: string; rows: Breakdown; dim: string; label?: (v: string) => string }) {
  type Row = Breakdown[number];
  const steps = rows[0]?.steps ?? [];
  return (
    <ChartFrame<Row>
      title={title}
      description={description}
      empty={rows.length ? undefined : "Nobody entered this funnel in the period yet."}
      table={{
        open: true,
        rows,
        columns: [
          { key: "value", label: dim, render: (r) => <span dir="auto">{label(r.value)}</span> },
          ...steps.map((s, i) => ({ key: s.key, label: s.label, numeric: true, render: (r: Row) => formatCount(r.steps[i]?.count ?? 0) })),
          { key: "rate", label: "End to end", numeric: true, render: (r) => formatPercent(r.steps.at(-1)?.ofFirst ?? 0) },
        ],
        csv: {
          fileName: title,
          columns: [
            { label: dim.toLowerCase(), value: (r) => r.value },
            ...steps.map((s, i) => ({ label: s.key, value: (r: Row) => r.steps[i]?.count ?? 0 })),
            { label: "end_to_end", value: (r) => (r.steps.at(-1)?.ofFirst ?? 0).toFixed(4) },
          ],
        },
      }}
    />
  );
}

export function FunnelReport({ filters }: { filters: Filters }) {
  const q = useReport<AnalyticsFunnelDto>("funnel", filters);
  if (q.error) return <ReportError error={q.error} />;
  if (!q.data) return <ReportSkeleton tiles={0} />;
  const d = q.data;
  if (!d.dataSince) return <NoEventsYet>The funnel will follow people from their first visit to starting a CV, downloading it, signing up and paying, with drop-off at each step.</NoEventsYet>;
  const compare = d.period.compare;
  const refreshing = q.isPlaceholderData;
  const main = d.main.steps;
  const tool = d.freeTool.steps;

  return (
    <div className="flex flex-col gap-8">
      <Section
        title="From visit to paid"
        description="People (visitors, joined to their account once they sign up) who did each step and every step before it in the period. The order within the period doesn't matter: many sign up before they download."
      >
        <ChartFrame
          title="Main funnel"
          refreshing={refreshing}
          empty={main[0]?.count ? undefined : "Nobody visited in this period yet. Each step and its drop-off will show here."}
          table={stepsTable(main, compare, "main-funnel")}
        >
          <FunnelChart steps={main} label="Main funnel: people at each step" />
        </ChartFrame>
        <div className="grid gap-4 xl:grid-cols-2">
          <BreakdownTable title="By source" description="First-touch source: the campaign or site that brought them." rows={d.main.bySource} dim="Source" />
          <BreakdownTable title="By device" description="The device they first came on." rows={d.main.byDevice} dim="Device" label={(v) => v.charAt(0).toUpperCase() + v.slice(1)} />
        </div>
      </Section>

      <Section title="From a free tool" description="People who used the ATS checker or a free AI writing tool, then started a CV and signed up.">
        <ChartFrame
          title="Free-tool funnel"
          refreshing={refreshing}
          empty={tool[0]?.count ? undefined : "Nobody used a free tool in this period yet."}
          table={stepsTable(tool, compare, "free-tool-funnel")}
        >
          <FunnelChart steps={tool} label="Free-tool funnel: people at each step" />
        </ChartFrame>
        <BreakdownTable title="By tool" description="The free tool they used first." rows={d.freeTool.byTool} dim="Tool" label={(v) => TOOL_LABEL[v] ?? v} />
      </Section>
    </div>
  );
}
