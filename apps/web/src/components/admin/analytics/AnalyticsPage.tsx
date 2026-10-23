"use client";

import { PageHeader, Tabs } from "@cvb/ui";
import { AppHeader } from "../../AppHeader";
import { RequireAuth } from "../../RequireAuth";
import { AdminTabs } from "../AdminTabs";
import { AcquisitionReport } from "./AcquisitionReport";
import { FilterBar } from "./FilterBar";
import { FunnelReport } from "./FunnelReport";
import { OverviewReport } from "./OverviewReport";
import { RevenueReport } from "./RevenueReport";
import { REPORT_LABEL, REPORTS, useFilters } from "./state";
import { UsageReport } from "./UsageReport";

/**
 * First-party analytics for admins: Overview, Funnel, Acquisition, Revenue, Usage & retention.
 * Events stay in our own database; the API checks the admin role on every report.
 */
export function AnalyticsPage() {
  const { report, filters, setFilters, hrefFor } = useFilters();
  return (
    <RequireAuth admin>
      {() => (
        <div className="min-h-dvh bg-canvas">
          <AppHeader />
          <main className="mx-auto flex w-full max-w-(--layout-xl) flex-col gap-6 px-4 pb-20 pt-10 sm:px-6">
            <PageHeader title="Admin" />
            <AdminTabs value="analytics" />
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-2xl font-bold tracking-tight text-ink">Analytics</h2>
              <p className="max-w-3xl text-sm leading-6 text-ink-3">
                Recorded by CV Builder itself, with no outside tracker: no cookies, no IP addresses, no names or emails. Browsers that ask not to be tracked are never
                counted. Money comes from billing records.
              </p>
            </div>
            <Tabs label="Analytics reports" value={report} items={REPORTS.map((r) => ({ id: r, label: REPORT_LABEL[r], href: hrefFor(r) }))} />
            <FilterBar filters={filters} onChange={setFilters} />
            <div role="tabpanel" aria-label={REPORT_LABEL[report]}>
              {report === "overview" && <OverviewReport filters={filters} />}
              {report === "funnel" && <FunnelReport filters={filters} />}
              {report === "acquisition" && <AcquisitionReport filters={filters} />}
              {report === "revenue" && <RevenueReport filters={filters} />}
              {report === "usage" && <UsageReport filters={filters} />}
            </div>
          </main>
        </div>
      )}
    </RequireAuth>
  );
}
