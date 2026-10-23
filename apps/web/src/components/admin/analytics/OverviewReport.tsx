"use client";

import type { AnalyticsOverviewDto, PointDto } from "@cvb/contracts";
import { ChartFrame, formatCount, formatMoney, formatPercent, LineChart, MetricTile } from "@/components/charts";
import { allZero, NoEventsYet, periodLegend, periodLines, ReportError, ReportSkeleton, Section, seriesTable, sparkOf, TileGrid } from "./shared";
import { useReport, type Filters } from "./state";

const CURRENCY_NAME: Record<string, string> = { usd: "US dollars", pkr: "Pakistani rupees" };

export function OverviewReport({ filters }: { filters: Filters }) {
  const q = useReport<AnalyticsOverviewDto>("overview", filters);
  if (q.error) return <ReportError error={q.error} />;
  if (!q.data) return <ReportSkeleton tiles={6} />;
  const d = q.data;
  const compare = d.period.compare;
  const refreshing = q.isPlaceholderData;

  if (!d.dataSince && d.tiles.signups.value === 0 && d.revenue.length === 0)
    return <NoEventsYet>The overview will show visitors, sessions, sign-ups, CVs created, downloads, paying customers and revenue, each against the period before.</NoEventsYet>;

  const t = d.tiles;
  const line = (title: string, points: PointDto[], description: string, empty: string) => (
    <ChartFrame
      title={title}
      description={description}
      legend={periodLegend(compare)}
      refreshing={refreshing}
      empty={allZero(points) ? empty : undefined}
      table={seriesTable(points, compare, formatCount, title)}
    >
      <LineChart labels={points.map((p) => p.date)} series={periodLines(points, title, compare)} label={`${title} by ${d.period.bucket}`} />
    </ChartFrame>
  );

  return (
    <div className={`flex flex-col gap-8 ${refreshing ? "cursor-progress" : ""}`}>
      <Section title="This period" description={`${d.period.from} to ${d.period.to}${compare ? `, compared with ${d.period.prevFrom} to ${d.period.prevTo}` : ""}.`}>
        <TileGrid wide>
          <MetricTile label="Visitors" value={formatCount(t.visitors.value)} metric={compare ? t.visitors : undefined} spark={sparkOf(d.series.visitors)} hint="Different people (or browsers)" />
          <MetricTile label="Sessions" value={formatCount(t.sessions.value)} metric={compare ? t.sessions : undefined} spark={sparkOf(d.series.sessions)} />
          <MetricTile label="Sign-ups" value={formatCount(t.signups.value)} metric={compare ? t.signups : undefined} spark={sparkOf(d.series.signups)} />
          <MetricTile label="CVs created" value={formatCount(t.cvsCreated.value)} metric={compare ? t.cvsCreated : undefined} spark={sparkOf(d.series.cvsCreated)} hint="Not counting tailored copies" />
          <MetricTile label="Downloads" value={formatCount(t.downloads.value)} metric={compare ? t.downloads : undefined} spark={sparkOf(d.series.downloads)} hint="PDF, Word and text" />
          <MetricTile label="Paying customers" value={formatCount(t.payingCustomers.value)} metric={compare ? t.payingCustomers : undefined} spark={sparkOf(d.series.payingCustomers)} hint="Paid at least once in the period" />
        </TileGrid>
      </Section>

      <Section title="Conversion" description="Shares of the period's people. The Funnel report follows them step by step.">
        <TileGrid wide>
          <MetricTile label="Visitor to CV" value={formatPercent(d.rates.visitorToCv.value)} metric={compare ? d.rates.visitorToCv : undefined} formatPrevious={formatPercent} hint="Visitors who started a CV" />
          <MetricTile label="Visitor to sign-up" value={formatPercent(d.rates.visitorToSignup.value)} metric={compare ? d.rates.visitorToSignup : undefined} formatPrevious={formatPercent} />
          <MetricTile label="Sign-up to paid" value={formatPercent(d.rates.signupToPaid.value)} metric={compare ? d.rates.signupToPaid : undefined} formatPrevious={formatPercent} hint="Of this period's sign-ups, those who paid" />
        </TileGrid>
      </Section>

      <Section title="Revenue" description="Collected in each currency, never added together. MRR, churn and plans are in the Revenue report.">
        {d.revenue.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface px-4 py-6 text-sm text-ink-3">No payments in this period yet. Passes, credit packs, subscription invoices and expert orders appear here, per currency.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {d.revenue.map((r) => {
              const fmt = (v: number) => formatMoney(v, r.currency);
              const title = `Revenue in ${CURRENCY_NAME[r.currency] ?? r.currency.toUpperCase()}`;
              return (
                <div key={r.currency} className="flex flex-col gap-3">
                  <MetricTile label={title} value={fmt(r.cents.value)} metric={compare ? r.cents : undefined} formatPrevious={fmt} />
                  <ChartFrame title={title} legend={periodLegend(compare)} refreshing={refreshing} table={seriesTable(r.series, compare, fmt, title)}>
                    <LineChart labels={r.series.map((p) => p.date)} series={periodLines(r.series, title, compare)} format="money" currency={r.currency} label={title} />
                  </ChartFrame>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Trends">
        <div className="grid gap-4 lg:grid-cols-2">
          {line("Visitors", d.series.visitors, "People who opened any page.", "No visits in this period yet. Each day's visitors will show here.")}
          {line("Sign-ups", d.series.signups, "New accounts.", "No sign-ups in this period yet.")}
          {line("CVs created", d.series.cvsCreated, "New CVs, signed in.", "No CVs created in this period yet.")}
          {line("Downloads", d.series.downloads, "PDF, Word and text files.", "No downloads in this period yet.")}
        </div>
      </Section>
    </div>
  );
}
