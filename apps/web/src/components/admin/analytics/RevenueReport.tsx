"use client";

import type { AnalyticsRevenueDto, MetricDto, RevenueCurrencyDto } from "@cvb/contracts";
import { EmptyState } from "@cvb/ui";
import { ChartFrame, ColumnChart, formatBucket, formatCount, formatMoney, formatPercent, LineChart, MetricTile } from "@/components/charts";
import { PLAN_LABEL } from "@/lib/plans";
import { periodLegend, periodLines, ReportError, ReportSkeleton, Section, seriesTable, TileGrid } from "./shared";
import { useReport, type Filters } from "./state";

const CURRENCY_NAME: Record<string, string> = { usd: "US dollars", pkr: "Pakistani rupees" };

type Sales = RevenueCurrencyDto["sales"];
const SALES: { key: keyof Sales; label: string; note: string }[] = [
  { key: "subscriptions", label: "Subscriptions", note: "New subscriptions; amount is invoices paid" },
  { key: "passes", label: "Job-Hunt Passes", note: "7 and 30 days" },
  { key: "creditPacks", label: "AI credit packs", note: "Bought on top of the allowance" },
  { key: "expertOrders", label: "Expert orders", note: "Paid reviews, writing and coaching" },
];

function CurrencyRevenue({ c, compare, refreshing }: { c: RevenueCurrencyDto; compare: boolean; refreshing: boolean }) {
  const money = (v: number) => formatMoney(v, c.currency);
  const m = (x: MetricDto) => (compare ? x : undefined);
  const churn = c.churnRate.value;
  const movementEmpty = c.movementSeries.every((p) => p.new + p.expansion + p.reactivation + p.churn + p.contraction === 0);
  return (
    <Section title={CURRENCY_NAME[c.currency] ?? c.currency.toUpperCase()} description="Read from billing records (subscriptions, invoices, passes, credit packs and expert orders), not from browser events.">
      <TileGrid>
        <MetricTile label="MRR" value={money(c.mrr.value)} metric={m(c.mrr)} formatPrevious={money} hint="Yearly plans count as a twelfth a month" />
        <MetricTile label="Active subscriptions" value={formatCount(c.activeSubscriptions.value)} metric={m(c.activeSubscriptions)} />
        <MetricTile label="Revenue collected" value={money(c.revenue.value)} metric={m(c.revenue)} formatPrevious={money} />
        <MetricTile label="Paying customers" value={formatCount(c.payingCustomers.value)} metric={m(c.payingCustomers)} />
        <MetricTile label="ARPPU" value={money(c.arppu.value)} metric={m(c.arppu)} formatPrevious={money} hint="Revenue per paying customer" />
        <MetricTile
          label="Revenue churn"
          value={churn === null ? "–" : formatPercent(churn)}
          metric={compare && churn !== null && c.churnRate.previous !== null ? { value: churn, previous: c.churnRate.previous, change: c.churnRate.previous ? (churn - c.churnRate.previous) / c.churnRate.previous : null } : undefined}
          good="down"
          formatPrevious={formatPercent}
          hint={churn === null ? "No MRR at the start of the period" : "MRR lost over MRR at the start"}
        />
        <MetricTile label="Refunds" value={money(c.refunds.value)} metric={m(c.refunds)} good="down" formatPrevious={money} />
        <MetricTile label="Failed payments" value={formatCount(c.failedPayments.value)} metric={m(c.failedPayments)} good="down" hint="Stripe retries these" />
      </TileGrid>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartFrame title="MRR" description="At the end of each day, week or month." legend={periodLegend(compare)} refreshing={refreshing} table={seriesTable(c.mrrSeries, compare, money, `MRR ${c.currency}`)}>
          <LineChart labels={c.mrrSeries.map((p) => p.date)} series={periodLines(c.mrrSeries, "MRR", compare)} format="money" currency={c.currency} label={`MRR in ${c.currency.toUpperCase()}`} />
        </ChartFrame>
        <ChartFrame
          title="Revenue collected"
          legend={periodLegend(compare)}
          refreshing={refreshing}
          empty={c.revenueSeries.every((p) => !p.value && !p.previous) ? "No payments in this period yet." : undefined}
          table={seriesTable(c.revenueSeries, compare, money, `Revenue ${c.currency}`)}
        >
          <LineChart labels={c.revenueSeries.map((p) => p.date)} series={periodLines(c.revenueSeries, "Revenue", compare)} format="money" currency={c.currency} label={`Revenue in ${c.currency.toUpperCase()}`} />
        </ChartFrame>
      </div>

      <ChartFrame
        title="MRR movements"
        description={`New ${money(c.movements.new.value)} · expansion ${money(c.movements.expansion.value)} · reactivated ${money(c.movements.reactivation.value)} · contraction −${money(c.movements.contraction.value)} · churn −${money(c.movements.churn.value)} · net ${c.movements.net.value < 0 ? "−" : "+"}${money(Math.abs(c.movements.net.value))}`}
        legend={[
          { label: "New", color: "var(--viz-ord-2)", shape: "rect" },
          { label: "Expansion and reactivation", color: "var(--viz-ord-4)", shape: "rect" },
          { label: "Churn and contraction", color: "var(--viz-loss)", shape: "rect" },
        ]}
        refreshing={refreshing}
        empty={movementEmpty ? "No subscription changes in this period yet. New, upgraded, downgraded and cancelled subscriptions will show here." : undefined}
        table={{
          rows: c.movementSeries,
          columns: [
            { key: "date", label: "Date", render: (r) => formatBucket(r.date, true) },
            { key: "new", label: "New", numeric: true, render: (r) => money(r.new) },
            { key: "expansion", label: "Expansion", numeric: true, render: (r) => money(r.expansion) },
            { key: "reactivation", label: "Reactivated", numeric: true, render: (r) => money(r.reactivation) },
            { key: "contraction", label: "Contraction", numeric: true, render: (r) => money(r.contraction) },
            { key: "churn", label: "Churn", numeric: true, render: (r) => money(r.churn) },
          ],
          csv: {
            fileName: `mrr-movements-${c.currency}`,
            columns: [
              { label: "date", value: (r) => r.date },
              { label: "new_cents", value: (r) => r.new },
              { label: "expansion_cents", value: (r) => r.expansion },
              { label: "reactivation_cents", value: (r) => r.reactivation },
              { label: "contraction_cents", value: (r) => r.contraction },
              { label: "churn_cents", value: (r) => r.churn },
            ],
          },
        }}
      >
        <ColumnChart
          labels={c.movementSeries.map((p) => p.date)}
          format="money"
          currency={c.currency}
          label="MRR gained and lost per period"
          series={[
            { key: "new", label: "New", values: c.movementSeries.map((p) => p.new), color: "var(--viz-ord-2)" },
            { key: "expansion", label: "Expansion and reactivation", values: c.movementSeries.map((p) => p.expansion + p.reactivation), color: "var(--viz-ord-4)" },
            { key: "lost", label: "Churn and contraction", values: c.movementSeries.map((p) => p.churn + p.contraction), color: "var(--viz-loss)", negative: true },
          ]}
        />
      </ChartFrame>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartFrame<Sales[keyof Sales] & { key: keyof Sales; label: string; note: string }>
          title="Sales in the period"
          table={{
            open: true,
            rows: SALES.map((s) => ({ ...s, ...c.sales[s.key] })),
            columns: [
              {
                key: "label",
                label: "What",
                render: (r) => (
                  <span className="flex flex-col">
                    {r.label}
                    <span className="cvb-caption font-normal">{r.note}</span>
                  </span>
                ),
              },
              { key: "count", label: "Sold", numeric: true, render: (r) => formatCount(r.count.value) },
              { key: "cents", label: "Amount", numeric: true, render: (r) => money(r.cents.value) },
              ...(compare ? [{ key: "previous", label: "Amount before", numeric: true, render: (r: Sales[keyof Sales]) => (r.cents.previous === null ? "–" : money(r.cents.previous)) }] : []),
            ],
            csv: {
              fileName: `sales-${c.currency}`,
              columns: [
                { label: "what", value: (r) => r.key },
                { label: "count", value: (r) => r.count.value },
                { label: "amount_cents", value: (r) => r.cents.value },
                ...(compare ? [{ label: "previous_amount_cents", value: (r: Sales[keyof Sales]) => r.cents.previous }] : []),
              ],
            },
          }}
        />
        <ChartFrame<RevenueCurrencyDto["byPlan"][number]>
          title="Live subscriptions by plan"
          description="Right now, whatever the date range."
          empty={c.byPlan.length ? undefined : "No live subscriptions in this currency yet."}
          table={{
            open: true,
            rows: c.byPlan,
            columns: [
              { key: "plan", label: "Plan", render: (r) => `${PLAN_LABEL[r.plan as keyof typeof PLAN_LABEL] ?? r.plan}, ${r.interval === "year" ? "yearly" : "monthly"}` },
              { key: "subscriptions", label: "Subscriptions", numeric: true, render: (r) => formatCount(r.subscriptions) },
              { key: "mrrCents", label: "MRR", numeric: true, render: (r) => money(r.mrrCents) },
            ],
            csv: {
              fileName: `plans-${c.currency}`,
              columns: [
                { label: "plan", value: (r) => r.plan },
                { label: "interval", value: (r) => r.interval },
                { label: "subscriptions", value: (r) => r.subscriptions },
                { label: "mrr_cents", value: (r) => r.mrrCents },
              ],
            },
          }}
        />
      </div>
    </Section>
  );
}

export function RevenueReport({ filters }: { filters: Filters }) {
  const q = useReport<AnalyticsRevenueDto>("revenue", filters);
  if (q.error) return <ReportError error={q.error} />;
  if (!q.data) return <ReportSkeleton />;
  const d = q.data;
  if (!d.currencies.length)
    return (
      <EmptyState icon="credit" title="No revenue yet">
        Once people subscribe or buy passes, credit packs or expert services, MRR, new and churned MRR, ARPPU, refunds and sales by plan show here, separately for US dollars and rupees.
      </EmptyState>
    );
  return (
    <div className="flex flex-col gap-10">
      {d.currencies.map((c) => (
        <CurrencyRevenue key={c.currency} c={c} compare={d.period.compare} refreshing={q.isPlaceholderData} />
      ))}
    </div>
  );
}
