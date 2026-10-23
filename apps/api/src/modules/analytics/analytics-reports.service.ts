import {
  ANALYTICS_EVENT_CATALOG,
  FEATURES,
  eventLabel,
  type AcquisitionRowDto,
  type AnalyticsAcquisitionDto,
  type AnalyticsFilters,
  type AnalyticsFunnelDto,
  type AnalyticsOverviewDto,
  type AnalyticsQuery,
  type AnalyticsRevenueDto,
  type AnalyticsUsageDto,
  type FeatureKey,
  type FunnelStepDto,
  type MetricDto,
  type RevenueCurrencyDto,
} from "@cvb/contracts";
import {
  CURRENCIES,
  alignSeries,
  arppu,
  averageRetention,
  bucketKey,
  bucketKeys,
  buildCohorts,
  comparison,
  funnel,
  funnelBreakdown,
  isCurrency,
  pageKind,
  resolvePeriod,
  revenueChurnRate,
  safeRatio,
  subscriptionMrr,
  type Currency,
  type FunnelGroup,
  type Period,
  type SubscriptionStatusName,
} from "@cvb/domain";
import { Inject, Injectable, Optional } from "@nestjs/common";
import {
  ACQUISITION_DIMS,
  ANALYTICS_REPORTS_REPOSITORY,
  type AcquisitionDim,
  type AnalyticsReportsRepository,
  type FunnelRow,
  type ReportWindow,
  type RevenueRows,
} from "./analytics-reports.repository.js";

const DAY = 86_400_000;
const CACHE_MS = 5 * 60_000;
const COHORT_WEEKS = 8;
const COHORT_COUNT = 12;

export const MAIN_FUNNEL = [
  { key: "visited", label: "Visited" },
  { key: "started", label: "Started a CV" },
  { key: "downloaded", label: "Downloaded" },
  { key: "signed_up", label: "Signed up" },
  { key: "paid", label: "Paid" },
] as const;

export const TOOL_FUNNEL = [
  { key: "tool_used", label: "Used a free tool" },
  { key: "started", label: "Started a CV" },
  { key: "signed_up", label: "Signed up" },
] as const;

/** Optional clock for tests. */
export const REPORTS_CLOCK = Symbol.for("cvb.api.AnalyticsReportsClock");

const day = (d: Date) => d.toISOString().slice(0, 10);
const lastDay = (exclusive: Date) => day(new Date(exclusive.getTime() - DAY));

/**
 * The analytics reports: one use case per report, built from small aggregates the query port
 * returns, with funnels, cohorts, MRR and period comparison done by @cvb/domain. Results are
 * cached for five minutes per query, since the same admin page asks repeatedly.
 */
@Injectable()
export class AnalyticsReportsService {
  private readonly cache = new Map<string, { at: number; value: Promise<unknown> }>();

  private readonly now: () => Date;

  constructor(
    @Inject(ANALYTICS_REPORTS_REPOSITORY) private readonly repo: AnalyticsReportsRepository,
    @Optional() @Inject(REPORTS_CLOCK) clock?: () => Date,
  ) {
    this.now = clock ?? (() => new Date());
  }

  private cached<T>(kind: string, q: AnalyticsQuery, build: () => Promise<T>): Promise<T> {
    const key = `${kind}:${JSON.stringify(q)}`;
    const t = this.now().getTime();
    const hit = this.cache.get(key);
    if (hit && t - hit.at < CACHE_MS) return hit.value as Promise<T>;
    if (this.cache.size > 200) this.cache.clear();
    const value = build().catch((e: unknown) => {
      this.cache.delete(key);
      throw e;
    });
    this.cache.set(key, { at: t, value });
    return value;
  }

  private setup(q: AnalyticsQuery) {
    const period = resolvePeriod(q, this.now());
    const filters: AnalyticsFilters = {
      source: q.source,
      medium: q.medium,
      campaign: q.campaign,
      device: q.device,
      country: q.country,
      locale: q.locale,
      currency: q.currency,
    };
    const cur: ReportWindow = { from: period.from, to: period.to, bucket: period.bucket };
    const prev: ReportWindow = { from: period.prevFrom, to: period.prevTo, bucket: period.bucket };
    const dto = {
      from: day(period.from),
      to: lastDay(period.to),
      prevFrom: day(period.prevFrom),
      prevTo: lastDay(period.prevTo),
      bucket: period.bucket,
      days: period.days,
      compare: q.compare,
    };
    return { period, filters, cur, prev, compare: q.compare, dto };
  }

  private since = async () => (await this.repo.dataSince())?.toISOString() ?? null;

  // ─── Overview ──────────────────────────────────────────────────────────────

  overview(q: AnalyticsQuery): Promise<AnalyticsOverviewDto> {
    return this.cached("overview", q, async () => {
      const { period, filters, cur, prev, compare, dto } = this.setup(q);
      const load = (w: ReportWindow) =>
        Promise.all([this.repo.traffic(w, filters), this.repo.signups(w, filters), this.repo.cvsCreated(w, filters), this.repo.payers(w, filters), this.repo.revenue(w, filters)]);
      const [now, before, dataSince] = await Promise.all([load(cur), compare ? load(prev) : Promise.resolve(null), this.since()]);
      const [traffic, signups, cvs, payers, revenue] = now;
      const m = (v: number, p: number | undefined) => comparison(v, compare ? (p ?? 0) : null);
      const rate = (a: number, b: number, pa?: number, pb?: number) => comparison(safeRatio(a, b), compare ? safeRatio(pa ?? 0, pb ?? 0) : null);
      const pt = before?.[0];
      const series = (rows: { key: string; value: number }[], prevRows?: { key: string; value: number }[]) => alignSeries(period, rows, compare ? prevRows : undefined);
      const trafficSeries = (k: "visitors" | "sessions" | "downloads", t: typeof traffic | undefined) => (t?.series ?? []).map((r) => ({ key: r.key, value: r[k] }));
      return {
        period: dto,
        dataSince,
        tiles: {
          visitors: m(traffic.visitors, pt?.visitors),
          sessions: m(traffic.sessions, pt?.sessions),
          signups: m(signups.total, before?.[1].total),
          cvsCreated: m(cvs.total, before?.[2].total),
          downloads: m(traffic.downloads, pt?.downloads),
          payingCustomers: m(payers.total, before?.[3].total),
        },
        // People-based shares, so none can pass 100%: visitors who started a CV, visitors who
        // signed up, and of the period's sign-ups those who paid in it.
        rates: {
          visitorToCv: rate(traffic.starters, traffic.visitors, pt?.starters, pt?.visitors),
          visitorToSignup: rate(signups.total, traffic.visitors, before?.[1].total, pt?.visitors),
          signupToPaid: rate(signups.paid, signups.total, before?.[1].paid, before?.[1].total),
        },
        revenue: this.currenciesWithMoney(filters, revenue, before?.[4]).map((currency) => {
          const total = (r: RevenueRows | undefined) => (r?.totals ?? []).filter((t) => t.currency === currency).reduce((s, t) => s + t.cents, 0);
          const rows = (r: RevenueRows | undefined) => (r?.series ?? []).filter((s) => s.currency === currency).map((s) => ({ key: s.key, value: s.cents }));
          return { currency, cents: m(total(revenue), total(before?.[4])), series: series(rows(revenue), rows(before?.[4])) };
        }),
        series: {
          visitors: series(trafficSeries("visitors", traffic), trafficSeries("visitors", pt)),
          sessions: series(trafficSeries("sessions", traffic), trafficSeries("sessions", pt)),
          signups: series(signups.series, before?.[1].series),
          cvsCreated: series(cvs.series, before?.[2].series),
          downloads: series(trafficSeries("downloads", traffic), trafficSeries("downloads", pt)),
          payingCustomers: series(payers.series, before?.[3].series),
        },
      };
    });
  }

  /** Currencies to show money for: the filtered one, else those with any payment in either period. */
  private currenciesWithMoney(f: AnalyticsFilters, ...rows: (RevenueRows | null | undefined)[]): Currency[] {
    if (f.currency) return [f.currency];
    const seen = new Set(rows.flatMap((r) => [...(r?.totals ?? []).filter((t) => t.cents > 0).map((t) => t.currency), ...(r?.refunds ?? []).map((t) => t.currency)]));
    return CURRENCIES.filter((c) => seen.has(c));
  }

  // ─── Funnel ────────────────────────────────────────────────────────────────

  funnel(q: AnalyticsQuery): Promise<AnalyticsFunnelDto> {
    return this.cached("funnel", q, async () => {
      const { filters, cur, prev, compare, dto } = this.setup(q);
      const [rows, prevRows, dataSince] = await Promise.all([
        this.repo.funnelGroups(cur, filters),
        compare ? this.repo.funnelGroups(prev, filters) : Promise.resolve(null),
        this.since(),
      ]);
      const mainKeys = MAIN_FUNNEL.map((s) => s.key);
      const toolKeys = TOOL_FUNNEL.map((s) => s.key);
      const main = (r: FunnelRow): FunnelGroup => ({ steps: [r.visited, r.started, r.downloaded, r.signedUp, r.paid], count: r.count });
      const tool = (r: FunnelRow): FunnelGroup => ({ steps: [r.tool, r.started, r.signedUp], count: r.count });
      const labelled = (defs: readonly { key: string; label: string }[], steps: ReturnType<typeof funnel>, previous?: ReturnType<typeof funnel>): FunnelStepDto[] =>
        steps.map((s, i) => ({ ...s, label: defs[i]!.label, previous: previous ? (previous[i]?.count ?? 0) : null }));
      const breakdown = (defs: readonly { key: string; label: string }[], groups: (FunnelGroup & { dim: string | null })[]) =>
        funnelBreakdown(
          defs.map((d) => d.key),
          groups,
        ).map((b) => ({ value: b.value, steps: labelled(defs, b.steps) }));
      return {
        period: dto,
        dataSince,
        main: {
          steps: labelled(MAIN_FUNNEL, funnel(mainKeys, rows.map(main)), prevRows ? funnel(mainKeys, prevRows.map(main)) : undefined),
          bySource: breakdown(MAIN_FUNNEL, rows.map((r) => ({ ...main(r), dim: r.source }))),
          byDevice: breakdown(MAIN_FUNNEL, rows.map((r) => ({ ...main(r), dim: r.device }))),
        },
        freeTool: {
          steps: labelled(TOOL_FUNNEL, funnel(toolKeys, rows.map(tool)), prevRows ? funnel(toolKeys, prevRows.map(tool)) : undefined),
          byTool: breakdown(TOOL_FUNNEL, rows.filter((r) => r.tool).map((r) => ({ ...tool(r), dim: r.toolName }))),
        },
      };
    });
  }

  // ─── Acquisition ───────────────────────────────────────────────────────────

  acquisition(q: AnalyticsQuery): Promise<AnalyticsAcquisitionDto> {
    return this.cached("acquisition", q, async () => {
      const { period, filters, cur, prev, compare, dto } = this.setup(q);
      const [rows, prevRows, mix, prevMix, dataSince] = await Promise.all([
        this.repo.acquisition(cur, filters),
        compare ? this.repo.acquisition(prev, filters) : Promise.resolve(null),
        this.repo.visitorMix(cur, filters),
        compare ? this.repo.visitorMix(prev, filters) : Promise.resolve(null),
        this.since(),
      ]);
      const table = (dim: AcquisitionDim): AcquisitionRowDto[] => {
        // No campaign or no referrer isn't a row worth showing; unknown landing/country/device is.
        const skipNull = dim === "campaign" || dim === "referrer";
        const before = new Map((prevRows ?? []).filter((r) => r.dim === dim).map((r) => [r.value ?? "(unknown)", r.visitors]));
        return rows
          .filter((r) => r.dim === dim && !(skipNull && r.value === null))
          .map((r) => {
            const value = r.value ?? "(unknown)";
            return {
              value,
              ...(dim === "landing" ? { kind: pageKind(value) } : {}),
              visitors: r.visitors,
              previousVisitors: compare ? (before.get(value) ?? 0) : null,
              signups: r.signups,
              paid: r.paid,
              signupRate: safeRatio(r.signups, r.visitors),
              paidRate: safeRatio(r.paid, r.visitors),
            };
          })
          .sort((a, b) => b.visitors - a.visitors || b.signups - a.signups || a.value.localeCompare(b.value))
          .slice(0, 50);
      };
      const byKey = new Map(mix.series.map((s) => [s.key, s]));
      const [sources, mediums, campaigns, referrers, landingPages, countries, devices] = ACQUISITION_DIMS.map(table) as AcquisitionRowDto[][];
      return {
        period: dto,
        dataSince,
        visitors: { new: comparison(mix.new, compare ? (prevMix?.new ?? 0) : null), returning: comparison(mix.returning, compare ? (prevMix?.returning ?? 0) : null) },
        series: bucketKeys(period.from, period.to, period.bucket).map((date) => ({ date, new: byKey.get(date)?.new ?? 0, returning: byKey.get(date)?.returning ?? 0 })),
        sources: sources!,
        mediums: mediums!,
        campaigns: campaigns!,
        referrers: referrers!,
        landingPages: landingPages!,
        countries: countries!,
        devices: devices!,
      };
    });
  }

  // ─── Revenue ───────────────────────────────────────────────────────────────

  revenue(q: AnalyticsQuery): Promise<AnalyticsRevenueDto> {
    return this.cached("revenue", q, async () => {
      const { period, filters, cur, prev, compare, dto } = this.setup(q);
      const [atPrevStart, atStart, atEnd, movements, money, prevMoney, plans] = await Promise.all([
        this.repo.mrrAt(period.prevFrom, filters),
        this.repo.mrrAt(period.from, filters),
        this.repo.mrrAt(period.to, filters),
        this.repo.movements(cur, period.prevFrom, filters),
        this.repo.revenue(cur, filters),
        compare ? this.repo.revenue(prev, filters) : Promise.resolve(null),
        this.repo.livePlans(filters),
      ]);
      const active = new Set<string>([
        ...this.currenciesWithMoney(filters, money, prevMoney),
        ...[...atStart, ...atEnd].filter((r) => r.mrr !== 0 || r.subscriptions > 0).map((r) => r.currency),
        ...movements.map((m) => m.currency),
      ]);
      const currencies = (filters.currency ? [filters.currency] : CURRENCIES.filter((c) => active.has(c))).filter(isCurrency);
      return { period: dto, currencies: currencies.map((c) => this.revenueFor(c, period, compare, { atPrevStart, atStart, atEnd, movements, money, prevMoney, plans })) };
    });
  }

  private revenueFor(
    currency: Currency,
    period: Period,
    compare: boolean,
    d: {
      atPrevStart: Awaited<ReturnType<AnalyticsReportsRepository["mrrAt"]>>;
      atStart: Awaited<ReturnType<AnalyticsReportsRepository["mrrAt"]>>;
      atEnd: Awaited<ReturnType<AnalyticsReportsRepository["mrrAt"]>>;
      movements: Awaited<ReturnType<AnalyticsReportsRepository["movements"]>>;
      money: RevenueRows;
      prevMoney: RevenueRows | null;
      plans: Awaited<ReturnType<AnalyticsReportsRepository["livePlans"]>>;
    },
  ): RevenueCurrencyDto {
    const at = (rows: typeof d.atEnd) => rows.find((r) => r.currency === currency) ?? { mrr: 0, subscriptions: 0 };
    const start = at(d.atStart);
    const end = at(d.atEnd);
    const prevStart = at(d.atPrevStart);
    const mv = d.movements.filter((m) => m.currency === currency);
    const kindSum = (current: boolean, kind: string) => mv.filter((m) => m.current === current && m.kind === kind).reduce((s, m) => s + Math.abs(m.cents), 0);
    const net = (current: boolean) => mv.filter((m) => m.current === current).reduce((s, m) => s + m.cents, 0);
    const mvMetric = (kind: string): MetricDto => comparison(kindSum(true, kind), compare ? kindSum(false, kind) : null);
    const c = (v: number, p: number | null | undefined): MetricDto => comparison(v, compare ? (p ?? 0) : null);

    const totals = (r: RevenueRows | null | undefined, kind?: string) =>
      (r?.totals ?? []).filter((t) => t.currency === currency && (kind ? t.kind === kind : t.kind !== "sub_start"));
    const cents = (r: RevenueRows | null | undefined, kind?: string) => totals(r, kind).reduce((s, t) => s + t.cents, 0);
    const count = (r: RevenueRows | null | undefined, kind: string) => totals(r, kind).reduce((s, t) => s + t.count, 0);
    const payers = (r: RevenueRows | null | undefined) => r?.payers.find((p) => p.currency === currency)?.users ?? 0;
    const refunds = (r: RevenueRows | null | undefined) => r?.refunds.find((p) => p.currency === currency) ?? { count: 0, cents: 0 };
    const failed = (r: RevenueRows | null | undefined) => r?.failed.find((p) => p.currency === currency)?.count ?? 0;
    const sale = (kind: string, countKind = kind) => ({
      count: c(count(d.money, countKind), d.prevMoney ? count(d.prevMoney, countKind) : null),
      cents: c(cents(d.money, kind), d.prevMoney ? cents(d.prevMoney, kind) : null),
    });

    // MRR at the end of each bucket: the opening MRR plus movements so far.
    const cumulative = (opening: number, current: boolean, keys: string[]) => {
      const perKey = new Map<string, number>();
      for (const m of mv.filter((x) => x.current === current)) perKey.set(m.key, (perKey.get(m.key) ?? 0) + m.cents);
      let running = opening;
      return keys.map((key) => ({ key, value: (running += perKey.get(key) ?? 0) }));
    };
    const keys = bucketKeys(period.from, period.to, period.bucket);
    const prevKeys = bucketKeys(period.prevFrom, period.prevTo, period.bucket);
    const series = (r: RevenueRows | null | undefined) => (r?.series ?? []).filter((s) => s.currency === currency).map((s) => ({ key: s.key, value: s.cents }));

    const plans = new Map<string, { plan: string; interval: string; subscriptions: number; mrrCents: number }>();
    for (const p of d.plans.filter((x) => x.currency === currency)) {
      const interval = p.interval === "year" ? "year" : "month";
      const k = `${p.plan}|${interval}`;
      const row = plans.get(k) ?? { plan: p.plan, interval, subscriptions: 0, mrrCents: 0 };
      row.subscriptions += p.count;
      row.mrrCents +=
        p.count *
        subscriptionMrr({
          status: p.status as SubscriptionStatusName,
          amountCents: p.amountCents,
          interval,
          plan: p.plan as "standard" | "premium" | "executive",
          currency,
        });
      plans.set(k, row);
    }

    const revenue = cents(d.money);
    const prevRevenue = d.prevMoney ? cents(d.prevMoney) : null;
    const lost = kindSum(true, "churn") + kindSum(true, "contraction");
    const prevLost = kindSum(false, "churn") + kindSum(false, "contraction");
    return {
      currency,
      mrr: comparison(end.mrr, compare ? start.mrr : null),
      activeSubscriptions: comparison(end.subscriptions, compare ? start.subscriptions : null),
      movements: {
        new: mvMetric("new"),
        expansion: mvMetric("expansion"),
        contraction: mvMetric("contraction"),
        churn: mvMetric("churn"),
        reactivation: mvMetric("reactivation"),
        net: comparison(net(true), compare ? net(false) : null),
      },
      revenue: comparison(revenue, prevRevenue),
      refunds: c(refunds(d.money).cents, d.prevMoney ? refunds(d.prevMoney).cents : null),
      failedPayments: c(failed(d.money), d.prevMoney ? failed(d.prevMoney) : null),
      payingCustomers: c(payers(d.money), d.prevMoney ? payers(d.prevMoney) : null),
      arppu: c(arppu(revenue, payers(d.money)), d.prevMoney ? arppu(prevRevenue ?? 0, payers(d.prevMoney)) : null),
      churnRate: { value: revenueChurnRate(start.mrr, lost), previous: compare ? revenueChurnRate(prevStart.mrr, prevLost) : null },
      sales: {
        subscriptions: sale("subscription", "sub_start"),
        passes: sale("pass"),
        creditPacks: sale("credits"),
        expertOrders: sale("order"),
      },
      mrrSeries: alignSeries(period, cumulative(start.mrr, true, keys), compare ? cumulative(prevStart.mrr, false, prevKeys) : undefined),
      revenueSeries: alignSeries(period, series(d.money), compare ? series(d.prevMoney) : undefined),
      movementSeries: keys.map((date) => {
        const at = mv.filter((m) => m.current && m.key === date);
        const k = (kind: string) => at.filter((m) => m.kind === kind).reduce((s, m) => s + Math.abs(m.cents), 0);
        return { date, new: k("new"), expansion: k("expansion"), contraction: k("contraction"), churn: k("churn"), reactivation: k("reactivation") };
      }),
      byPlan: [...plans.values()].sort((a, b) => b.mrrCents - a.mrrCents),
    };
  }

  // ─── Usage & retention ─────────────────────────────────────────────────────

  usage(q: AnalyticsQuery): Promise<AnalyticsUsageDto> {
    return this.cached("usage", q, async () => {
      const { period, filters, cur, prev, compare, dto } = this.setup(q);
      const mapping = Object.entries(ANALYTICS_EVENT_CATALOG).flatMap(([name, spec]) =>
        "feature" in spec && spec.feature ? [{ name, feature: spec.feature as string }] : [],
      );
      // Cohorts: the last twelve sign-up weeks up to the end of the period.
      const cohortFrom = new Date(`${bucketKey(new Date(period.to.getTime() - DAY - (COHORT_COUNT - 1) * 7 * DAY), "week")}T00:00:00.000Z`);
      const [act, prevAct, feats, prevFeats, top, credits, prevCredits, cohorts, dataSince] = await Promise.all([
        this.repo.active(cur, filters),
        compare ? this.repo.active(prev, filters) : Promise.resolve(null),
        this.repo.featureUsage(cur, filters, mapping),
        compare ? this.repo.featureUsage(prev, filters, mapping) : Promise.resolve(null),
        this.repo.topEvents(cur, filters, 15),
        this.repo.credits(cur, filters),
        compare ? this.repo.credits(prev, filters) : Promise.resolve(null),
        this.repo.cohorts(cohortFrom, period.to, filters, COHORT_WEEKS),
        this.since(),
      ]);
      const dau = (a: typeof act | null) => (a ? a.personDays / period.days : 0);
      const c = (v: number, p: number | undefined) => comparison(v, compare ? (p ?? 0) : null);
      const rows = buildCohorts({ cohorts: cohorts.cohorts, activity: cohorts.activity, weeks: COHORT_WEEKS, now: this.now() });
      return {
        period: dto,
        dataSince,
        dau: c(dau(act), prevAct ? dau(prevAct) : undefined),
        wau: c(act.wau, prevAct?.wau),
        mau: c(act.mau, prevAct?.mau),
        stickiness: c(safeRatio(dau(act), act.mau), prevAct ? safeRatio(dau(prevAct), prevAct.mau) : undefined),
        activeSeries: alignSeries(period, act.series, compare ? prevAct?.series : undefined),
        features: (Object.keys(FEATURES) as FeatureKey[])
          .map((key) => {
            const f = feats.find((x) => x.feature === key);
            return {
              key,
              label: FEATURES[key],
              events: f?.events ?? 0,
              users: f?.users ?? 0,
              previousUsers: compare ? (prevFeats?.find((x) => x.feature === key)?.users ?? 0) : null,
            };
          })
          .sort((a, b) => b.users - a.users || b.events - a.events),
        cohorts: { weeks: COHORT_WEEKS, rows, average: averageRetention(rows, COHORT_WEEKS) },
        topEvents: top.map((t) => ({ ...t, label: eventLabel(t.name) })),
        aiCredits: { spent: c(credits.spent, prevCredits?.spent), users: c(credits.users, prevCredits?.users) },
      };
    });
  }
}
