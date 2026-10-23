import type { AnalyticsFilters } from "@cvb/contracts";
import { DB } from "@cvb/db/nest";
import { Prisma, type DbClient } from "@cvb/db";
import type { Bucket } from "@cvb/domain";
import { Inject, Injectable } from "@nestjs/common";
import type { AcquisitionDim, AnalyticsReportsRepository, FunnelRow, ReportWindow, RevenueRows } from "./analytics-reports.repository.js";

type Sql = Prisma.Sql;
const DAY = 86_400_000;

/** A timestamp parameter as a UTC `timestamp` (the columns store UTC without a time zone). */
const ts = (d: Date): Sql => Prisma.sql`${d.toISOString()}::timestamp`;
const UNIT: Record<Bucket, string> = { day: "day", week: "week", month: "month" };
const FORMAT: Record<Bucket, string> = { day: "YYYY-MM-DD", week: "YYYY-MM-DD", month: "YYYY-MM" };
/** Bucket key for a timestamp column, matching `bucketKey` in @cvb/domain. */
const bucketOf = (col: Sql, b: Bucket): Sql => Prisma.sql`to_char(date_trunc(${Prisma.raw(`'${UNIT[b]}'`)}, ${col}), ${Prisma.raw(`'${FORMAT[b]}'`)})`;
const n = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
const and = (parts: Sql[]): Sql => (parts.length ? Prisma.sql` AND ${Prisma.join(parts, " AND ")}` : Prisma.empty);

const DOWNLOADS = Prisma.sql`('pdf_downloaded', 'docx_downloaded', 'txt_downloaded')`;

/**
 * Person-level dimension filters. `acq` is the account's stored first touch; `v` the browser's
 * visitor row; `e` the event itself (last resort for device, country and locale).
 */
function personFilters(f: AnalyticsFilters, cols: { acq: string | null; v: string | null; e: string | null }): Sql[] {
  const pick = (key: string, vCol: string | null, eCol: string | null = null) =>
    Prisma.raw(
      `COALESCE(${[cols.acq ? `${cols.acq}->>'${key}'` : null, cols.v && vCol ? `${cols.v}.${vCol}` : null, cols.e && eCol ? `${cols.e}.${eCol}` : null]
        .filter(Boolean)
        .join(", ")}, NULL)`,
    );
  const out: Sql[] = [];
  if (f.source) out.push(Prisma.sql`${pick("source", "source")} = ${f.source}`);
  if (f.medium) out.push(Prisma.sql`${pick("medium", "medium")} = ${f.medium}`);
  if (f.campaign) out.push(Prisma.sql`${pick("campaign", "campaign")} = ${f.campaign}`);
  if (f.device) out.push(Prisma.sql`${pick("device", "device", "device")} = ${f.device}`);
  if (f.country) out.push(Prisma.sql`${pick("country", "country", "country")} = ${f.country}`);
  if (f.locale) out.push(Prisma.sql`${pick("locale", "locale", "locale")} = ${f.locale}`);
  return out;
}

const userFilters = (f: AnalyticsFilters, alias = "u") => personFilters(f, { acq: `${alias}.acquisition`, v: null, e: null });

@Injectable()
export class PrismaAnalyticsReportsRepository implements AnalyticsReportsRepository {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  /** Events in the window, with the person behind them and their first-touch dimensions. */
  private events(w: { from: Date; to: Date }, f: AnalyticsFilters): Sql {
    return Prisma.sql`
      ev AS (
        SELECT e.name, e.created_at, e.session_id, e.anonymous_id, e.props,
          e.user_id AS signed_in,
          COALESCE(e.user_id, v.user_id) AS uid,
          COALESCE(e.user_id, v.user_id, e.anonymous_id) AS person,
          COALESCE(u.acquisition->>'source', v.source) AS d_source,
          COALESCE(u.acquisition->>'device', v.device, e.device) AS d_device,
          COALESCE(v.first_seen_at, e.created_at) AS first_seen_at
        FROM analytics_events e
        LEFT JOIN analytics_visitors v ON v.anonymous_id = e.anonymous_id
        LEFT JOIN users u ON u.id = COALESCE(e.user_id, v.user_id)
        WHERE e.created_at >= ${ts(w.from)} AND e.created_at < ${ts(w.to)}
          ${and(personFilters(f, { acq: "u.acquisition", v: "v", e: "e" }))}
      )`;
  }

  /**
   * Money in, per payment: passes, credit packs, subscription invoices and expert orders, plus
   * subscription starts from MRR history ("sub_start", 0 cents) so payers recorded before
   * invoices were stored still count. Expert orders come from the order table, not webhooks.
   */
  private payments(w: { from: Date; to: Date }, f: AnalyticsFilters): Sql {
    return Prisma.sql`
      pay AS (
        SELECT p.user_id, p.at, p.currency, p.cents, p.kind FROM (
          SELECT user_id, created_at AS at, currency, amount_cents AS cents, 'pass' AS kind FROM passes WHERE amount_cents > 0
          UNION ALL
          SELECT user_id, processed_at, currency, amount_cents, CASE WHEN type = 'invoice.paid' THEN 'subscription' ELSE 'credits' END
          FROM billing_events
          WHERE amount_cents > 0 AND currency IS NOT NULL AND (type = 'invoice.paid' OR (type = 'payment.completed' AND offer LIKE 'credits%'))
          UNION ALL
          SELECT user_id, paid_at, currency, price_cents, 'order' FROM service_orders WHERE paid_at IS NOT NULL AND included = false AND price_cents > 0
          UNION ALL
          SELECT user_id, occurred_at, currency, 0, 'sub_start' FROM mrr_movements WHERE kind IN ('new', 'reactivation')
        ) p
        LEFT JOIN users u ON u.id = p.user_id
        WHERE p.at >= ${ts(w.from)} AND p.at < ${ts(w.to)}
          ${f.currency ? Prisma.sql`AND p.currency = ${f.currency}` : Prisma.empty}
          ${and(userFilters(f))}
      )`;
  }

  async dataSince(): Promise<Date | null> {
    const rows = await this.db.$queryRaw<{ at: Date | null }[]>`SELECT min(created_at) AS at FROM analytics_events`;
    return rows[0]?.at ?? null;
  }

  async traffic(w: ReportWindow, f: AnalyticsFilters) {
    const key = bucketOf(Prisma.sql`created_at`, w.bucket);
    const rows = await this.db.$queryRaw<{ key: string | null; visitors: bigint; sessions: bigint; downloads: bigint; starters: bigint }[]>`
      WITH ${this.events(w, f)}
      SELECT ${key} AS key,
        count(DISTINCT person) AS visitors,
        count(DISTINCT session_id) AS sessions,
        count(*) FILTER (WHERE name IN ${DOWNLOADS}) AS downloads,
        count(DISTINCT person) FILTER (WHERE name = 'cv_started') AS starters
      FROM ev WHERE anonymous_id NOT LIKE 'u:%'
      GROUP BY ROLLUP (${key})`;
    const total = rows.find((r) => r.key === null);
    return {
      visitors: n(total?.visitors),
      sessions: n(total?.sessions),
      downloads: n(total?.downloads),
      starters: n(total?.starters),
      series: rows.filter((r) => r.key !== null).map((r) => ({ key: r.key!, visitors: n(r.visitors), sessions: n(r.sessions), downloads: n(r.downloads) })),
    };
  }

  private async keyed(query: Sql): Promise<{ total: number; series: { key: string; value: number }[] }> {
    const rows = await this.db.$queryRaw<{ key: string | null; value: bigint }[]>(query);
    return {
      total: n(rows.find((r) => r.key === null)?.value),
      series: rows.filter((r) => r.key !== null).map((r) => ({ key: r.key!, value: n(r.value) })),
    };
  }

  async signups(w: ReportWindow, f: AnalyticsFilters) {
    const key = bucketOf(Prisma.sql`u.created_at`, w.bucket);
    const rows = await this.db.$queryRaw<{ key: string | null; value: bigint; paid: bigint }[]>`
      WITH ${this.payments(w, f)}
      SELECT ${key} AS key, count(*) AS value,
        count(*) FILTER (WHERE EXISTS (SELECT 1 FROM pay WHERE pay.user_id = u.id)) AS paid
      FROM users u
      WHERE u.created_at >= ${ts(w.from)} AND u.created_at < ${ts(w.to)} ${and(userFilters(f))}
      GROUP BY ROLLUP (${key})`;
    const total = rows.find((r) => r.key === null);
    return {
      total: n(total?.value),
      paid: n(total?.paid),
      series: rows.filter((r) => r.key !== null).map((r) => ({ key: r.key!, value: n(r.value) })),
    };
  }

  cvsCreated(w: ReportWindow, f: AnalyticsFilters) {
    // Tailored copies are made from an existing CV, so they don't count as new CVs.
    const key = bucketOf(Prisma.sql`r.created_at`, w.bucket);
    return this.keyed(Prisma.sql`
      SELECT ${key} AS key, count(*) AS value
      FROM resumes r JOIN users u ON u.id = r.user_id
      WHERE r.created_at >= ${ts(w.from)} AND r.created_at < ${ts(w.to)} AND r.base_resume_id IS NULL ${and(userFilters(f))}
      GROUP BY ROLLUP (${key})`);
  }

  payers(w: ReportWindow, f: AnalyticsFilters) {
    const key = bucketOf(Prisma.sql`at`, w.bucket);
    return this.keyed(Prisma.sql`
      WITH ${this.payments(w, f)}
      SELECT ${key} AS key, count(DISTINCT user_id) AS value
      FROM pay WHERE user_id IS NOT NULL
      GROUP BY ROLLUP (${key})`);
  }

  async revenue(w: ReportWindow, f: AnalyticsFilters): Promise<RevenueRows> {
    const key = bucketOf(Prisma.sql`at`, w.bucket);
    const money = await this.db.$queryRaw<{ currency: string; kind: string | null; key: string | null; count: bigint; cents: bigint | null }[]>`
      WITH ${this.payments(w, f)}
      SELECT currency, CASE WHEN GROUPING(kind) = 0 THEN kind END AS kind, CASE WHEN GROUPING(${key}) = 0 THEN ${key} END AS key,
        count(*) AS count, sum(cents) AS cents
      FROM pay
      GROUP BY GROUPING SETS ((currency, kind), (currency, ${key}))`;
    const payers = await this.db.$queryRaw<{ currency: string; users: bigint }[]>`
      WITH ${this.payments(w, f)}
      SELECT currency, count(DISTINCT user_id) AS users FROM pay WHERE cents > 0 AND user_id IS NOT NULL GROUP BY currency`;
    const other = await this.db.$queryRaw<{ currency: string | null; type: string; count: bigint; cents: bigint | null }[]>`
      SELECT b.currency, b.type, count(*) AS count, sum(b.amount_cents) AS cents
      FROM billing_events b LEFT JOIN users u ON u.id = b.user_id
      WHERE b.type IN ('charge.refunded', 'invoice.payment_failed')
        AND b.processed_at >= ${ts(w.from)} AND b.processed_at < ${ts(w.to)}
        ${f.currency ? Prisma.sql`AND b.currency = ${f.currency}` : Prisma.empty}
        ${and(userFilters(f))}
      GROUP BY 1, 2`;
    return {
      totals: money.filter((r) => r.kind !== null).map((r) => ({ currency: r.currency, kind: r.kind!, count: n(r.count), cents: n(r.cents) })),
      series: money.filter((r) => r.kind === null && r.key !== null).map((r) => ({ currency: r.currency, key: r.key!, cents: n(r.cents) })),
      payers: payers.map((r) => ({ currency: r.currency, users: n(r.users) })),
      refunds: other
        .filter((r) => r.type === "charge.refunded" && r.currency)
        .map((r) => ({ currency: r.currency!, count: n(r.count), cents: n(r.cents) })),
      failed: other.filter((r) => r.type === "invoice.payment_failed" && r.currency).map((r) => ({ currency: r.currency!, count: n(r.count) })),
    };
  }

  async funnelGroups(w: ReportWindow, f: AnalyticsFilters): Promise<FunnelRow[]> {
    const rows = await this.db.$queryRaw<
      {
        visited: boolean;
        started: boolean;
        downloaded: boolean;
        signed_up: boolean;
        paid: boolean;
        tool: boolean;
        tool_name: string | null;
        source: string | null;
        device: string | null;
        count: bigint;
      }[]
    >`
      WITH ${this.events(w, f)}, ${this.payments(w, f)},
      people AS (
        SELECT person, max(uid) AS uid,
          bool_or(name IN ('page_view', 'visit')) AS visited,
          bool_or(name = 'cv_started') AS started,
          bool_or(name IN ${DOWNLOADS}) AS downloaded,
          bool_or(name = 'free_tool_used' OR (name = 'ats_check_run' AND props->>'where' = 'free_tool')) AS tool,
          min(CASE WHEN name = 'free_tool_used' THEN props->>'tool'
                   WHEN name = 'ats_check_run' AND props->>'where' = 'free_tool' THEN 'ats_checker' END) AS tool_name,
          min(d_source) AS source,
          min(d_device) AS device
        FROM ev WHERE anonymous_id NOT LIKE 'u:%'
        GROUP BY person
      ),
      flags AS (
        SELECT people.*,
          (uid IS NOT NULL AND EXISTS (
            SELECT 1 FROM users s WHERE s.id = people.uid AND s.created_at >= ${ts(w.from)} AND s.created_at < ${ts(w.to)}
          )) AS signed_up,
          (uid IS NOT NULL AND EXISTS (SELECT 1 FROM pay WHERE pay.user_id = people.uid)) AS paid
        FROM people
      )
      SELECT visited, started, downloaded, signed_up, paid, tool, tool_name, source, device, count(*) AS count
      FROM flags
      GROUP BY visited, started, downloaded, signed_up, paid, tool, tool_name, source, device`;
    return rows.map((r) => ({
      visited: r.visited,
      started: r.started,
      downloaded: r.downloaded,
      signedUp: r.signed_up,
      paid: r.paid,
      tool: r.tool,
      toolName: r.tool_name,
      source: r.source,
      device: r.device,
      count: n(r.count),
    }));
  }

  async acquisition(w: ReportWindow, f: AnalyticsFilters) {
    // New people in the window by first touch: browsers first seen in the window, skipping
    // accounts that already had an older browser.
    const dims = "source, medium, campaign, referrer, landing, country, device";
    const rows = await this.db.$queryRaw<{ dim: AcquisitionDim; value: string | null; visitors: bigint; signups: bigint; paid: bigint }[]>`
      WITH ${this.payments(w, f)},
      vis AS (
        SELECT DISTINCT ON (COALESCE(v.user_id, v.anonymous_id))
          v.user_id,
          COALESCE(u.acquisition->>'source', v.source) AS source,
          COALESCE(u.acquisition->>'medium', v.medium) AS medium,
          COALESCE(u.acquisition->>'campaign', v.campaign) AS campaign,
          COALESCE(u.acquisition->>'referrer', v.referrer_domain) AS referrer,
          COALESCE(u.acquisition->>'landing', v.landing_path) AS landing,
          COALESCE(u.acquisition->>'country', v.country) AS country,
          COALESCE(u.acquisition->>'device', v.device) AS device
        FROM analytics_visitors v
        LEFT JOIN users u ON u.id = v.user_id
        WHERE v.first_seen_at >= ${ts(w.from)} AND v.first_seen_at < ${ts(w.to)}
          AND (v.user_id IS NULL OR NOT EXISTS (
            SELECT 1 FROM analytics_visitors o WHERE o.user_id = v.user_id AND o.first_seen_at < ${ts(w.from)}
          ))
          ${and(personFilters(f, { acq: "u.acquisition", v: "v", e: null }))}
        ORDER BY COALESCE(v.user_id, v.anonymous_id), v.first_seen_at
      ),
      conv AS (
        SELECT vis.*,
          (user_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM users s WHERE s.id = vis.user_id AND s.created_at >= ${ts(w.from)} AND s.created_at < ${ts(w.to)}
          )) AS signed,
          (user_id IS NOT NULL AND EXISTS (SELECT 1 FROM pay WHERE pay.user_id = vis.user_id)) AS paid
        FROM vis
      )
      SELECT
        CASE WHEN GROUPING(source) = 0 THEN 'source' WHEN GROUPING(medium) = 0 THEN 'medium'
             WHEN GROUPING(campaign) = 0 THEN 'campaign' WHEN GROUPING(referrer) = 0 THEN 'referrer'
             WHEN GROUPING(landing) = 0 THEN 'landing' WHEN GROUPING(country) = 0 THEN 'country' ELSE 'device' END AS dim,
        CASE WHEN GROUPING(source) = 0 THEN source WHEN GROUPING(medium) = 0 THEN medium
             WHEN GROUPING(campaign) = 0 THEN campaign WHEN GROUPING(referrer) = 0 THEN referrer
             WHEN GROUPING(landing) = 0 THEN landing WHEN GROUPING(country) = 0 THEN country ELSE device END AS value,
        count(*) AS visitors,
        count(*) FILTER (WHERE signed) AS signups,
        count(*) FILTER (WHERE paid) AS paid
      FROM conv
      GROUP BY GROUPING SETS ${Prisma.raw(`(${dims.split(", ").map((d) => `(${d})`).join(", ")})`)}`;
    return rows.map((r) => ({ dim: r.dim, value: r.value, visitors: n(r.visitors), signups: n(r.signups), paid: n(r.paid) }));
  }

  async visitorMix(w: ReportWindow, f: AnalyticsFilters) {
    const rows = await this.db.$queryRaw<{ key: string | null; new: bigint; returning: bigint }[]>`
      WITH ${this.events(w, f)},
      act AS (
        SELECT person, ${bucketOf(Prisma.sql`created_at`, w.bucket)} AS key, min(first_seen_at) AS fs
        FROM ev WHERE anonymous_id NOT LIKE 'u:%' GROUP BY 1, 2
      ),
      pfs AS (SELECT person, min(fs) AS fs FROM act GROUP BY person)
      SELECT a.key,
        count(*) FILTER (WHERE ${bucketOf(Prisma.sql`p.fs`, w.bucket)} = a.key) AS "new",
        count(*) FILTER (WHERE ${bucketOf(Prisma.sql`p.fs`, w.bucket)} <> a.key) AS "returning"
      FROM act a JOIN pfs p USING (person) GROUP BY a.key
      UNION ALL
      SELECT NULL, count(*) FILTER (WHERE fs >= ${ts(w.from)}), count(*) FILTER (WHERE fs < ${ts(w.from)}) FROM pfs`;
    const total = rows.find((r) => r.key === null);
    return {
      new: n(total?.new),
      returning: n(total?.returning),
      series: rows.filter((r) => r.key !== null).map((r) => ({ key: r.key!, new: n(r.new), returning: n(r.returning) })),
    };
  }

  async mrrAt(at: Date, f: AnalyticsFilters) {
    const rows = await this.db.$queryRaw<{ currency: string; mrr: bigint | null; subscriptions: bigint }[]>`
      SELECT currency, sum(s) AS mrr, count(*) FILTER (WHERE s > 0) AS subscriptions
      FROM (
        SELECT m.subscription_ref, m.currency, sum(m.delta_cents) AS s
        FROM mrr_movements m LEFT JOIN users u ON u.id = m.user_id
        WHERE m.occurred_at < ${ts(at)}
          ${f.currency ? Prisma.sql`AND m.currency = ${f.currency}` : Prisma.empty}
          ${and(userFilters(f))}
        GROUP BY 1, 2
      ) x
      GROUP BY currency`;
    return rows.map((r) => ({ currency: r.currency, mrr: n(r.mrr), subscriptions: n(r.subscriptions) }));
  }

  async movements(w: ReportWindow, prevFrom: Date, f: AnalyticsFilters) {
    const rows = await this.db.$queryRaw<{ currency: string; kind: string; current: boolean; key: string; count: bigint; cents: bigint }[]>`
      SELECT m.currency, m.kind, m.occurred_at >= ${ts(w.from)} AS current,
        ${bucketOf(Prisma.sql`m.occurred_at`, w.bucket)} AS key, count(*) AS count, sum(m.delta_cents) AS cents
      FROM mrr_movements m LEFT JOIN users u ON u.id = m.user_id
      WHERE m.occurred_at >= ${ts(prevFrom)} AND m.occurred_at < ${ts(w.to)}
        ${f.currency ? Prisma.sql`AND m.currency = ${f.currency}` : Prisma.empty}
        ${and(userFilters(f))}
      GROUP BY 1, 2, 3, 4`;
    return rows.map((r) => ({ currency: r.currency, kind: r.kind, current: r.current, key: r.key, count: n(r.count), cents: n(r.cents) }));
  }

  async livePlans(f: AnalyticsFilters) {
    const rows = await this.db.$queryRaw<{ currency: string; plan: string; interval: string | null; amount_cents: number | null; status: string; count: bigint }[]>`
      SELECT s.currency, lower(s.plan::text) AS plan, s.interval, s.amount_cents, lower(s.status::text) AS status, count(*) AS count
      FROM subscriptions s JOIN users u ON u.id = s.user_id
      WHERE s.status IN ('ACTIVE', 'PAST_DUE')
        ${f.currency ? Prisma.sql`AND s.currency = ${f.currency}` : Prisma.empty}
        ${and(userFilters(f))}
      GROUP BY 1, 2, 3, 4, 5`;
    return rows.map((r) => ({ currency: r.currency, plan: r.plan, interval: r.interval, amountCents: r.amount_cents, status: r.status, count: n(r.count) }));
  }

  async active(w: ReportWindow, f: AnalyticsFilters) {
    // WAU and MAU look back from the end of the window, even when the window is shorter.
    const lookback = { from: new Date(Math.min(w.from.getTime(), w.to.getTime() - 30 * DAY)), to: w.to };
    const totals = await this.db.$queryRaw<{ person_days: bigint; wau: bigint; mau: bigint }[]>`
      WITH ${this.events(lookback, f)}
      SELECT
        count(DISTINCT signed_in || ':' || to_char(created_at, 'YYYY-MM-DD')) FILTER (WHERE created_at >= ${ts(w.from)}) AS person_days,
        count(DISTINCT signed_in) FILTER (WHERE created_at >= ${ts(new Date(w.to.getTime() - 7 * DAY))}) AS wau,
        count(DISTINCT signed_in) FILTER (WHERE created_at >= ${ts(new Date(w.to.getTime() - 30 * DAY))}) AS mau
      FROM ev WHERE signed_in IS NOT NULL`;
    const series = await this.db.$queryRaw<{ key: string; value: bigint }[]>`
      WITH ${this.events(w, f)}
      SELECT ${bucketOf(Prisma.sql`created_at`, w.bucket)} AS key, count(DISTINCT signed_in) AS value
      FROM ev WHERE signed_in IS NOT NULL GROUP BY 1`;
    const t = totals[0];
    return { personDays: n(t?.person_days), wau: n(t?.wau), mau: n(t?.mau), series: series.map((r) => ({ key: r.key, value: n(r.value) })) };
  }

  async featureUsage(w: ReportWindow, f: AnalyticsFilters, mapping: { name: string; feature: string }[]) {
    if (!mapping.length) return [];
    const values = Prisma.join(mapping.map((m) => Prisma.sql`(${m.name}, ${m.feature})`));
    const rows = await this.db.$queryRaw<{ feature: string; events: bigint; users: bigint }[]>`
      WITH ${this.events(w, f)}
      SELECT fm.feature, count(*) AS events, count(DISTINCT ev.person) AS users
      FROM ev JOIN (VALUES ${values}) AS fm(name, feature) ON fm.name = ev.name
      GROUP BY fm.feature`;
    return rows.map((r) => ({ feature: r.feature, events: n(r.events), users: n(r.users) }));
  }

  async topEvents(w: ReportWindow, f: AnalyticsFilters, limit: number) {
    const rows = await this.db.$queryRaw<{ name: string; events: bigint; people: bigint }[]>`
      WITH ${this.events(w, f)}
      SELECT name, count(*) AS events, count(DISTINCT person) AS people
      FROM ev GROUP BY name ORDER BY 2 DESC, 1 LIMIT ${limit}`;
    return rows.map((r) => ({ name: r.name, events: n(r.events), people: n(r.people) }));
  }

  async credits(w: ReportWindow, f: AnalyticsFilters) {
    const rows = await this.db.$queryRaw<{ spent: bigint | null; users: bigint }[]>`
      SELECT -sum(c.delta) AS spent, count(DISTINCT c.user_id) AS users
      FROM credit_ledger c JOIN users u ON u.id = c.user_id
      WHERE c.delta < 0 AND c.created_at >= ${ts(w.from)} AND c.created_at < ${ts(w.to)} ${and(userFilters(f))}`;
    return { spent: n(rows[0]?.spent), users: n(rows[0]?.users) };
  }

  async cohorts(from: Date, to: Date, f: AnalyticsFilters, weeks: number) {
    const sizes = await this.db.$queryRaw<{ week: string; size: bigint }[]>`
      SELECT to_char(date_trunc('week', u.created_at), 'YYYY-MM-DD') AS week, count(*) AS size
      FROM users u WHERE u.created_at >= ${ts(from)} AND u.created_at < ${ts(to)} ${and(userFilters(f))}
      GROUP BY 1`;
    const activity = await this.db.$queryRaw<{ week: string; offset: number; users: bigint }[]>`
      WITH c AS (
        SELECT u.id, date_trunc('week', u.created_at) AS wk
        FROM users u WHERE u.created_at >= ${ts(from)} AND u.created_at < ${ts(to)} ${and(userFilters(f))}
      )
      SELECT to_char(c.wk, 'YYYY-MM-DD') AS week,
        (floor(extract(epoch FROM (date_trunc('week', e.created_at) - c.wk)) / 604800))::int AS "offset",
        count(DISTINCT c.id) AS users
      FROM c JOIN analytics_events e ON e.user_id = c.id
      WHERE e.created_at >= c.wk AND e.created_at < c.wk + make_interval(weeks => ${weeks + 1})
        AND e.anonymous_id NOT LIKE 'u:%'
      GROUP BY 1, 2`;
    return {
      cohorts: sizes.map((r) => ({ week: r.week, size: n(r.size) })),
      activity: activity.map((r) => ({ week: r.week, offset: Number(r.offset), users: n(r.users) })),
    };
  }
}
