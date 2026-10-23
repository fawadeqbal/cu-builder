import type { AnalyticsFilters } from "@cvb/contracts";
import type { Bucket } from "@cvb/domain";

/** A half-open UTC window [from, to) and how to bucket its series. */
export type ReportWindow = { from: Date; to: Date; bucket: Bucket };

export type Keyed = { key: string; value: number };

export type FunnelRow = {
  visited: boolean;
  started: boolean;
  downloaded: boolean;
  signedUp: boolean;
  paid: boolean;
  tool: boolean;
  toolName: string | null;
  source: string | null;
  device: string | null;
  count: number;
};

export const ACQUISITION_DIMS = ["source", "medium", "campaign", "referrer", "landing", "country", "device"] as const;
export type AcquisitionDim = (typeof ACQUISITION_DIMS)[number];

export type RevenueRows = {
  /** Per currency and kind ("subscription" invoices, "pass", "credits", "order"; "sub_start" counts subscription starts, 0 cents). */
  totals: { currency: string; kind: string; count: number; cents: number }[];
  series: { currency: string; key: string; cents: number }[];
  payers: { currency: string; users: number }[];
  refunds: { currency: string; count: number; cents: number }[];
  failed: { currency: string; count: number }[];
};

/**
 * Read-only query port for the analytics reports. Every method aggregates in the database and
 * returns small rows; the maths (funnels, cohorts, MRR, comparisons) happens in @cvb/domain.
 *
 * Dimension filters are person-level first-touch facts: the account's stored acquisition when
 * there is one, else the browser's first visit. The currency filter applies to money only.
 */
export interface AnalyticsReportsRepository {
  dataSince(): Promise<Date | null>;
  /** People, sessions, downloads, and people who started a CV (browser events). */
  traffic(w: ReportWindow, f: AnalyticsFilters): Promise<{ visitors: number; sessions: number; downloads: number; starters: number; series: { key: string; visitors: number; sessions: number; downloads: number }[] }>;
  /** Accounts made in the window, and how many of them paid in it. */
  signups(w: ReportWindow, f: AnalyticsFilters): Promise<{ total: number; paid: number; series: Keyed[] }>;
  cvsCreated(w: ReportWindow, f: AnalyticsFilters): Promise<{ total: number; series: Keyed[] }>;
  payers(w: ReportWindow, f: AnalyticsFilters): Promise<{ total: number; series: Keyed[] }>;
  revenue(w: ReportWindow, f: AnalyticsFilters): Promise<RevenueRows>;
  funnelGroups(w: ReportWindow, f: AnalyticsFilters): Promise<FunnelRow[]>;
  acquisition(w: ReportWindow, f: AnalyticsFilters): Promise<{ dim: AcquisitionDim; value: string | null; visitors: number; signups: number; paid: number }[]>;
  visitorMix(w: ReportWindow, f: AnalyticsFilters): Promise<{ new: number; returning: number; series: { key: string; new: number; returning: number }[] }>;
  /** MRR and live subscriptions per currency just before `at`. */
  mrrAt(at: Date, f: AnalyticsFilters): Promise<{ currency: string; mrr: number; subscriptions: number }[]>;
  /** MRR movements from `prevFrom` to `w.to`, marked as in the current or the previous period. */
  movements(w: ReportWindow, prevFrom: Date, f: AnalyticsFilters): Promise<{ currency: string; kind: string; current: boolean; key: string; count: number; cents: number }[]>;
  /** Live subscriptions now, grouped by plan, interval and price (MRR is worked out by the caller). */
  livePlans(f: AnalyticsFilters): Promise<{ currency: string; plan: string; interval: string | null; amountCents: number | null; status: string; count: number }[]>;
  active(w: ReportWindow, f: AnalyticsFilters): Promise<{ personDays: number; wau: number; mau: number; series: Keyed[] }>;
  featureUsage(w: ReportWindow, f: AnalyticsFilters, mapping: { name: string; feature: string }[]): Promise<{ feature: string; events: number; users: number }[]>;
  topEvents(w: ReportWindow, f: AnalyticsFilters, limit: number): Promise<{ name: string; events: number; people: number }[]>;
  credits(w: ReportWindow, f: AnalyticsFilters): Promise<{ spent: number; users: number }>;
  cohorts(from: Date, to: Date, f: AnalyticsFilters, weeks: number): Promise<{ cohorts: { week: string; size: number }[]; activity: { week: string; offset: number; users: number }[] }>;
}

export const ANALYTICS_REPORTS_REPOSITORY = Symbol.for("cvb.api.AnalyticsReportsRepository");
