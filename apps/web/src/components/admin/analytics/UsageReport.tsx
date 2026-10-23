"use client";

import type { AnalyticsUsageDto } from "@cvb/contracts";
import { BarChart, ChartFrame, CohortHeatmap, formatCount, formatDecimal, formatPercent, LineChart, MetricTile } from "@/components/charts";
import { allZero, NoEventsYet, periodLegend, periodLines, ReportError, ReportSkeleton, Section, seriesTable, TileGrid } from "./shared";
import { useReport, type Filters } from "./state";

type Feature = AnalyticsUsageDto["features"][number];
type TopEvent = AnalyticsUsageDto["topEvents"][number];

export function UsageReport({ filters }: { filters: Filters }) {
  const q = useReport<AnalyticsUsageDto>("usage", filters);
  if (q.error) return <ReportError error={q.error} />;
  if (!q.data) return <ReportSkeleton />;
  const d = q.data;
  if (!d.dataSince) return <NoEventsYet>Usage will show daily, weekly and monthly active people, which features they use, and how many come back in the weeks after signing up.</NoEventsYet>;
  const compare = d.period.compare;
  const refreshing = q.isPlaceholderData;
  const activeTitle = d.period.bucket === "day" ? "Active people per day" : d.period.bucket === "week" ? "Active people per week" : "Active people per month";
  const usedFeatures = d.features.filter((f) => f.events > 0 || (f.previousUsers ?? 0) > 0);

  return (
    <div className="flex flex-col gap-8">
      <Section title="Active people" description="Signed-in people who did anything in the product. WAU and MAU count the last 7 and 30 days of the period.">
        <TileGrid>
          <MetricTile label="Daily active (average)" value={formatDecimal(d.dau.value)} metric={compare ? d.dau : undefined} formatPrevious={formatDecimal} />
          <MetricTile label="Weekly active" value={formatCount(d.wau.value)} metric={compare ? d.wau : undefined} />
          <MetricTile label="Monthly active" value={formatCount(d.mau.value)} metric={compare ? d.mau : undefined} />
          <MetricTile label="Stickiness" value={formatPercent(d.stickiness.value)} metric={compare ? d.stickiness : undefined} formatPrevious={formatPercent} hint="Average daily active over monthly active" />
          <MetricTile label="AI credits spent" value={formatCount(d.aiCredits.spent.value)} metric={compare ? d.aiCredits.spent : undefined} hint={`By ${formatCount(d.aiCredits.users.value)} people`} />
        </TileGrid>
        <ChartFrame
          title={activeTitle}
          legend={periodLegend(compare)}
          refreshing={refreshing}
          empty={allZero(d.activeSeries) ? "Nobody signed in did anything in this period yet." : undefined}
          table={seriesTable(d.activeSeries, compare, formatCount, activeTitle)}
        >
          <LineChart labels={d.activeSeries.map((p) => p.date)} series={periodLines(d.activeSeries, "Active people", compare)} label={activeTitle} />
        </ChartFrame>
      </Section>

      <Section title="Features" description="People who used each feature at least once in the period (visitors and signed-in), and how many times it was used.">
        <ChartFrame<Feature>
          title="Feature use"
          refreshing={refreshing}
          empty={usedFeatures.length ? undefined : "No feature use in this period yet."}
          table={{
            rows: d.features,
            columns: [
              { key: "label", label: "Feature", render: (f) => f.label },
              { key: "users", label: "People", numeric: true, render: (f) => formatCount(f.users) },
              ...(compare ? [{ key: "previousUsers", label: "People before", numeric: true, render: (f: Feature) => (f.previousUsers === null ? "–" : formatCount(f.previousUsers)) }] : []),
              { key: "events", label: "Times used", numeric: true, render: (f) => formatCount(f.events) },
            ],
            csv: {
              fileName: "feature-use",
              columns: [
                { label: "feature", value: (f) => f.key },
                { label: "people", value: (f) => f.users },
                ...(compare ? [{ label: "previous_people", value: (f: Feature) => f.previousUsers }] : []),
                { label: "times_used", value: (f) => f.events },
              ],
            },
          }}
        >
          <BarChart
            label="People per feature"
            max={15}
            rows={usedFeatures.map((f) => ({ key: f.key, label: f.label, value: f.users, previous: compare ? f.previousUsers : undefined, detail: `${formatCount(f.events)} times` }))}
          />
        </ChartFrame>
      </Section>

      <Section title="Retention" description="People who signed up each week, and the share active again in each week after (week 0 is the sign-up week). The last twelve sign-up weeks up to the end of the period.">
        <ChartFrame
          title="Weekly cohorts"
          refreshing={refreshing}
          empty={d.cohorts.rows.length ? undefined : "Nobody signed up in these weeks yet. Each week's sign-ups and how many come back will show here."}
        >
          <CohortHeatmap rows={d.cohorts.rows} weeks={d.cohorts.weeks} average={d.cohorts.average} />
        </ChartFrame>
      </Section>

      <Section title="Top events">
        <ChartFrame<TopEvent>
          title="Most recorded events"
          empty={d.topEvents.length ? undefined : "No events in this period yet."}
          table={{
            open: true,
            rows: d.topEvents,
            columns: [
              { key: "label", label: "Event", render: (e) => (
                <span className="flex flex-col">
                  {e.label}
                  <code className="cvb-caption font-normal">{e.name}</code>
                </span>
              ) },
              { key: "events", label: "Times", numeric: true, render: (e) => formatCount(e.events) },
              { key: "people", label: "People", numeric: true, render: (e) => formatCount(e.people) },
            ],
            csv: {
              fileName: "top-events",
              columns: [
                { label: "event", value: (e) => e.name },
                { label: "times", value: (e) => e.events },
                { label: "people", value: (e) => e.people },
              ],
            },
          }}
        />
      </Section>
    </div>
  );
}
