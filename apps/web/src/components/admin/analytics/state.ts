"use client";

import type { AnalyticsQuery } from "@cvb/contracts";
import { RANGE_PRESETS, isCurrency, type Currency, type RangePreset } from "@cvb/domain";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { api } from "@/lib/api";

export const REPORTS = ["overview", "funnel", "acquisition", "revenue", "usage"] as const;
export type Report = (typeof REPORTS)[number];
export const REPORT_LABEL: Record<Report, string> = {
  overview: "Overview",
  funnel: "Funnel",
  acquisition: "Acquisition",
  revenue: "Revenue",
  usage: "Usage & retention",
};

export const RANGE_LABEL: Record<RangePreset, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "12m": "Last 12 months",
  custom: "Custom range",
};

export const DEVICES = ["mobile", "tablet", "desktop"] as const;

/** The report filters as the URL holds them: shareable, and the back button works. */
export type Filters = {
  range: RangePreset;
  from?: string;
  to?: string;
  compare: boolean;
  source?: string;
  device?: (typeof DEVICES)[number];
  country?: string;
  currency?: Currency;
};

const KEYS = ["range", "from", "to", "compare", "source", "device", "country", "currency"] as const;

export function readFilters(params: URLSearchParams): Filters {
  const range = RANGE_PRESETS.find((r) => r === params.get("range")) ?? "30d";
  const device = DEVICES.find((d) => d === params.get("device"));
  const currency = params.get("currency");
  const country = params.get("country");
  const date = (k: string) => {
    const v = params.get(k);
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
  };
  return {
    range,
    ...(range === "custom" ? { from: date("from"), to: date("to") } : {}),
    // Comparing with the previous period is on unless switched off.
    compare: params.get("compare") !== "0",
    ...(params.get("source") ? { source: params.get("source")!.slice(0, 100) } : {}),
    ...(device ? { device } : {}),
    ...(country && /^[A-Za-z]{2}$/.test(country) ? { country: country.toUpperCase() } : {}),
    ...(isCurrency(currency) ? { currency } : {}),
  };
}

/** Query string for the API (and the page URL): only what differs from the defaults. */
export function filtersQuery(f: Filters): string {
  const p = new URLSearchParams();
  p.set("range", f.range);
  if (f.range === "custom") {
    if (f.from) p.set("from", f.from);
    if (f.to) p.set("to", f.to);
  }
  p.set("compare", f.compare ? "1" : "0");
  if (f.source) p.set("source", f.source);
  if (f.device) p.set("device", f.device);
  if (f.country) p.set("country", f.country);
  if (f.currency) p.set("currency", f.currency);
  return p.toString();
}

export function useFilters(): { report: Report; filters: Filters; setFilters: (patch: Partial<Filters>) => void; hrefFor: (report: Report) => string } {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const report = REPORTS.find((r) => r === params.get("report")) ?? "overview";
  const filters = useMemo(() => readFilters(new URLSearchParams(params.toString())), [params]);
  const setFilters = useCallback(
    (patch: Partial<Filters>) => {
      const next = { ...filters, ...patch };
      const p = new URLSearchParams(filtersQuery(next));
      if (report !== "overview") p.set("report", report);
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [filters, report, router, pathname],
  );
  const hrefFor = useCallback(
    (r: Report) => {
      const p = new URLSearchParams(params.toString());
      for (const k of [...p.keys()]) if (!(KEYS as readonly string[]).includes(k)) p.delete(k);
      if (r !== "overview") p.set("report", r);
      const qs = p.toString();
      return `${pathname}${qs ? `?${qs}` : ""}`;
    },
    [params, pathname],
  );
  return { report, filters, setFilters, hrefFor };
}

/**
 * One report from the API. While a new filter loads, the previous result stays on screen
 * (dimmed by the charts) instead of flashing a skeleton.
 */
export function useReport<T>(report: Report, filters: Filters, extra?: Partial<AnalyticsQuery>) {
  const qs = filtersQuery(filters) + (extra ? `&${new URLSearchParams(Object.entries(extra).map(([k, v]) => [k, String(v)])).toString()}` : "");
  return useQuery({
    queryKey: ["admin", "analytics", report, qs],
    queryFn: () => api.get<T>(`/admin/analytics/${report}?${qs}`),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
