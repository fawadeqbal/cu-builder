"use client";

import type { AnalyticsAcquisitionDto } from "@cvb/contracts";
import { RANGE_PRESETS, type Currency, type RangePreset } from "@cvb/domain";
import { Button, Select, Switch, TextField } from "@cvb/ui";
import { DEVICES, RANGE_LABEL, useReport, type Filters } from "./state";

const DEVICE_LABEL: Record<(typeof DEVICES)[number], string> = { mobile: "Mobile", tablet: "Tablet", desktop: "Desktop" };
const countryName = (code: string) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
};
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

/**
 * The one filter row above every report: date range first, then compare, then the dimensions.
 * Source and country choices come from the people seen in the chosen range.
 */
export function FilterBar({ filters, onChange }: { filters: Filters; onChange: (patch: Partial<Filters>) => void }) {
  // Unfiltered, so the lists don't shrink to the current choice.
  const options = useReport<AnalyticsAcquisitionDto>("acquisition", { range: filters.range, from: filters.from, to: filters.to, compare: false });
  const sources = (options.data?.sources ?? []).map((s) => s.value);
  const countries = (options.data?.countries ?? []).map((c) => c.value).filter((c) => /^[A-Z]{2}$/.test(c));
  const withCurrent = (list: string[], v?: string) => (v && !list.includes(v) ? [v, ...list] : list);
  const filtered = Boolean(filters.source || filters.device || filters.country || filters.currency);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 sm:p-4" role="group" aria-label="Report filters">
      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
        <Select
          size="sm"
          label="Date range"
          className="col-span-2 sm:w-44"
          value={filters.range}
          onChange={(e) => {
            const range = e.target.value as RangePreset;
            onChange(range === "custom" ? { range, from: filters.from ?? daysAgo(29), to: filters.to ?? today() } : { range, from: undefined, to: undefined });
          }}
          options={RANGE_PRESETS.map((r) => ({ value: r, label: RANGE_LABEL[r] }))}
        />
        {filters.range === "custom" && (
          <>
            <TextField size="sm" type="date" label="From" className="sm:w-40" value={filters.from ?? ""} max={filters.to ?? today()} onChange={(e) => onChange({ from: e.target.value || undefined })} />
            <TextField size="sm" type="date" label="To" className="sm:w-40" value={filters.to ?? ""} min={filters.from} max={today()} onChange={(e) => onChange({ to: e.target.value || undefined })} />
          </>
        )}
        <Select
          size="sm"
          label="Source"
          className="sm:w-44"
          value={filters.source ?? ""}
          onChange={(e) => onChange({ source: e.target.value || undefined })}
          options={[{ value: "", label: "All sources" }, ...withCurrent(sources, filters.source).map((s) => ({ value: s, label: s }))]}
        />
        <Select
          size="sm"
          label="Device"
          className="sm:w-36"
          value={filters.device ?? ""}
          onChange={(e) => onChange({ device: (e.target.value || undefined) as Filters["device"] })}
          options={[{ value: "", label: "All devices" }, ...DEVICES.map((d) => ({ value: d, label: DEVICE_LABEL[d] }))]}
        />
        <Select
          size="sm"
          label="Country"
          className="sm:w-44"
          value={filters.country ?? ""}
          onChange={(e) => onChange({ country: e.target.value || undefined })}
          options={[{ value: "", label: "All countries" }, ...withCurrent(countries, filters.country).map((c) => ({ value: c, label: countryName(c) }))]}
        />
        <Select
          size="sm"
          label="Currency"
          hint="Money and payments only"
          className="sm:w-36"
          value={filters.currency ?? ""}
          onChange={(e) => onChange({ currency: (e.target.value || undefined) as Currency | undefined })}
          options={[
            { value: "", label: "Both" },
            { value: "usd", label: "USD" },
            { value: "pkr", label: "PKR" },
          ]}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Switch label="Compare with the previous period" checked={filters.compare} onChange={(on) => onChange({ compare: on })} />
        {filtered && (
          <Button size="sm" variant="ghost" icon="x" onClick={() => onChange({ source: undefined, device: undefined, country: undefined, currency: undefined })}>
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
