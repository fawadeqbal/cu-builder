"use client";

import type { AcquisitionRowDto, AnalyticsAcquisitionDto } from "@cvb/contracts";
import { Badge } from "@cvb/ui";
import { BarChart, ChartFrame, ColumnChart, formatBucket, formatCount, formatPercent, MetricTile } from "@/components/charts";
import { NoEventsYet, ReportError, ReportSkeleton, Section, TileGrid } from "./shared";
import { useReport, type Filters } from "./state";

const KIND_LABEL: Record<string, string> = {
  home: "Home",
  cv_example: "CV example",
  free_tool: "Free tool",
  template: "Templates",
  pricing: "Pricing",
  builder: "Builder",
  app: "App",
  auth: "Sign-in",
  other: "Other",
};

const countryName = (code: string) => {
  if (!/^[A-Z]{2}$/.test(code)) return code;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
};

function AcquisitionTable({
  title,
  description,
  rows,
  dim,
  compare,
  empty,
  label = (v) => v,
  chart = false,
  refreshing,
}: {
  title: string;
  description: string;
  rows: AcquisitionRowDto[];
  dim: string;
  compare: boolean;
  empty: string;
  label?: (v: string) => string;
  chart?: boolean;
  refreshing?: boolean;
}) {
  return (
    <ChartFrame<AcquisitionRowDto>
      title={title}
      description={description}
      refreshing={refreshing}
      empty={rows.length ? undefined : empty}
      table={{
        open: true,
        rows,
        columns: [
          {
            key: "value",
            label: dim,
            render: (r) => (
              <span className="flex min-w-40 flex-wrap items-center gap-2">
                <span dir="auto" className="break-all">
                  {label(r.value)}
                </span>
                {r.kind && r.kind !== "other" && <Badge>{KIND_LABEL[r.kind] ?? r.kind}</Badge>}
              </span>
            ),
          },
          { key: "visitors", label: "New visitors", numeric: true, render: (r) => formatCount(r.visitors) },
          ...(compare ? [{ key: "previousVisitors", label: "Before", numeric: true, render: (r: AcquisitionRowDto) => (r.previousVisitors === null ? "–" : formatCount(r.previousVisitors)) }] : []),
          { key: "signups", label: "Sign-ups", numeric: true, render: (r) => formatCount(r.signups) },
          { key: "signupRate", label: "Sign-up rate", numeric: true, render: (r) => formatPercent(r.signupRate) },
          { key: "paid", label: "Paid", numeric: true, render: (r) => formatCount(r.paid) },
          { key: "paidRate", label: "Paid rate", numeric: true, render: (r) => formatPercent(r.paidRate) },
        ],
        csv: {
          fileName: title,
          columns: [
            { label: dim.toLowerCase(), value: (r) => r.value },
            ...(rows.some((r) => r.kind) ? [{ label: "page_kind", value: (r: AcquisitionRowDto) => r.kind }] : []),
            { label: "new_visitors", value: (r) => r.visitors },
            ...(compare ? [{ label: "previous_period_visitors", value: (r: AcquisitionRowDto) => r.previousVisitors }] : []),
            { label: "signups", value: (r) => r.signups },
            { label: "signup_rate", value: (r) => r.signupRate.toFixed(4) },
            { label: "paid", value: (r) => r.paid },
            { label: "paid_rate", value: (r) => r.paidRate.toFixed(4) },
          ],
        },
      }}
    >
      {chart && (
        <BarChart
          label={`${title}: new visitors`}
          rows={rows.map((r) => ({
            key: r.value,
            label: label(r.value),
            value: r.visitors,
            previous: compare ? r.previousVisitors : undefined,
            detail: `${formatCount(r.signups)} sign-ups · ${formatCount(r.paid)} paid`,
          }))}
        />
      )}
    </ChartFrame>
  );
}

export function AcquisitionReport({ filters }: { filters: Filters }) {
  const q = useReport<AnalyticsAcquisitionDto>("acquisition", filters);
  if (q.error) return <ReportError error={q.error} />;
  if (!q.data) return <ReportSkeleton tiles={2} />;
  const d = q.data;
  if (!d.dataSince) return <NoEventsYet>Acquisition will show where new visitors come from (campaigns, sites, landing pages, countries) and how many of them sign up and pay.</NoEventsYet>;
  const compare = d.period.compare;
  const refreshing = q.isPlaceholderData;
  const mixEmpty = d.series.every((s) => s.new === 0 && s.returning === 0);
  const t = (title: string, description: string, rows: AcquisitionRowDto[], dim: string, empty: string, extra: { label?: (v: string) => string; chart?: boolean } = {}) => (
    <AcquisitionTable title={title} description={description} rows={rows} dim={dim} compare={compare} empty={empty} refreshing={refreshing} {...extra} />
  );

  return (
    <div className="flex flex-col gap-8">
      <Section title="New and returning" description="New: first seen in this period. Returning: first seen before it.">
        <TileGrid>
          <MetricTile label="New visitors" value={formatCount(d.visitors.new.value)} metric={compare ? d.visitors.new : undefined} />
          <MetricTile label="Returning visitors" value={formatCount(d.visitors.returning.value)} metric={compare ? d.visitors.returning : undefined} />
        </TileGrid>
        <ChartFrame
          title="Visitors, new and returning"
          legend={[
            { label: "New", color: "var(--viz-1)", shape: "rect" },
            { label: "Returning", color: "var(--viz-2)", shape: "rect" },
          ]}
          refreshing={refreshing}
          empty={mixEmpty ? "No visits in this period yet." : undefined}
          table={{
            rows: d.series,
            columns: [
              { key: "date", label: "Date", render: (r) => formatBucket(r.date, true) },
              { key: "new", label: "New", numeric: true, render: (r) => formatCount(r.new) },
              { key: "returning", label: "Returning", numeric: true, render: (r) => formatCount(r.returning) },
            ],
            csv: {
              fileName: "visitors-new-returning",
              columns: [
                { label: "date", value: (r) => r.date },
                { label: "new", value: (r) => r.new },
                { label: "returning", value: (r) => r.returning },
              ],
            },
          }}
        >
          <ColumnChart
            labels={d.series.map((s) => s.date)}
            label="Visitors per period, new and returning"
            series={[
              { key: "new", label: "New", values: d.series.map((s) => s.new), color: "var(--viz-1)" },
              { key: "returning", label: "Returning", values: d.series.map((s) => s.returning), color: "var(--viz-2)" },
            ]}
          />
        </ChartFrame>
      </Section>

      <Section title="Where new visitors come from" description="First touch: the UTM tags or the site that brought each person the first time. Sign-ups and paid count the same people within the period.">
        {t("Sources", "UTM source, else the referring site (google, linkedin), else direct.", d.sources, "Source", "No new visitors in this period yet.", { chart: true })}
        <div className="grid gap-4 xl:grid-cols-2">
          {t("Mediums", "UTM medium, else organic, social, referral or none.", d.mediums, "Medium", "No new visitors in this period yet.")}
          {t("Campaigns", "UTM campaign names.", d.campaigns, "Campaign", "No campaign links were used in this period. Add utm_campaign to links you share to see them here.")}
        </div>
        {t("Referring sites", "The site a person came from, by domain.", d.referrers, "Site", "Nobody arrived from another site in this period yet.", { chart: true })}
        {t("Landing pages", "The first page people saw: CV examples, free tools, the home page and more.", d.landingPages, "Page", "No landing pages recorded in this period yet.", { chart: true })}
        <div className="grid gap-4 xl:grid-cols-2">
          {t("Countries", "From the hosting proxy's country header, else the browser's time zone.", d.countries, "Country", "No countries recorded in this period yet.", { label: countryName })}
          {t("Devices", "Device class from the browser (the browser string itself isn't kept).", d.devices, "Device", "No devices recorded in this period yet.", { label: (v) => v.charAt(0).toUpperCase() + v.slice(1) })}
        </div>
      </Section>
    </div>
  );
}
