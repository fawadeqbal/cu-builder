/**
 * The job feed. Each provider is an adapter behind `JobFeedProvider`; `JobFeed` asks every
 * enabled one, tolerates failures, removes duplicates (first-hand company postings win over
 * aggregator copies) and sorts newest first. Providers
 * receive `fetch` so tests run without the network.
 */

import { stripHtml, type FeedJob, type FeedQuery, type JobFeedProvider } from "./core";
import { ArbeitnowProvider, CompanyBoardsProvider, DEFAULT_BOARDS, HimalayasProvider, parseBoards, RemoteOkProvider } from "./sources";

export * from "./core";
export * from "./sources";

type Fetch = typeof fetch;

const TIMEOUT_MS = 8_000;

const money = (min?: number | null, max?: number | null, currency = "") => {
  const f = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
  if (min && max && min !== max) return `${currency}${f(min)}–${currency}${f(max)}`;
  if (min || max) return `${currency}${f((min || max)!)}`;
  return "";
};

/** Remote jobs from Remotive's public API (no key; credit Remotive and link to the posting). */
export class RemotiveProvider implements JobFeedProvider {
  readonly id = "remotive";
  constructor(private readonly http: Fetch = fetch) {}

  async search({ keywords }: FeedQuery): Promise<FeedJob[]> {
    const url = `https://remotive.com/api/remote-jobs?limit=40&search=${encodeURIComponent(keywords)}`;
    const res = await this.http(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`Remotive ${res.status}`);
    const body = (await res.json()) as { jobs?: Record<string, unknown>[] };
    return (body.jobs ?? []).map((j) => ({
      externalId: `remotive:${String(j.id)}`,
      source: "Remotive",
      title: String(j.title ?? ""),
      company: String(j.company_name ?? ""),
      location: String(j.candidate_required_location ?? "Remote"),
      remote: true,
      salary: String(j.salary ?? ""),
      url: String(j.url ?? ""),
      description: stripHtml(String(j.description ?? "")).slice(0, 8000),
      postedAt: j.publication_date ? new Date(String(j.publication_date)).toISOString() : null,
    }));
  }
}

/** Jooble (covers Pakistan and the Gulf). Needs a free API key. */
export class JoobleProvider implements JobFeedProvider {
  readonly id = "jooble";
  constructor(
    private readonly apiKey: string,
    private readonly http: Fetch = fetch,
  ) {}

  async search({ keywords, location, page = 1 }: FeedQuery): Promise<FeedJob[]> {
    const res = await this.http(`https://jooble.org/api/${this.apiKey}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ keywords, location: location ?? "", page: String(page) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Jooble ${res.status}`);
    const body = (await res.json()) as { jobs?: Record<string, unknown>[] };
    return (body.jobs ?? []).map((j) => {
      const loc = String(j.location ?? "");
      return {
        externalId: `jooble:${String(j.id)}`,
        source: "Jooble",
        title: stripHtml(String(j.title ?? "")),
        company: String(j.company ?? ""),
        location: loc,
        remote: /remote/i.test(`${loc} ${String(j.type ?? "")}`),
        salary: String(j.salary ?? ""),
        url: String(j.link ?? ""),
        description: stripHtml(String(j.snippet ?? "")),
        postedAt: j.updated ? new Date(String(j.updated)).toISOString() : null,
      };
    });
  }
}

/** Adzuna (US, UK, EU and more). Needs a free app id and key. */
export class AdzunaProvider implements JobFeedProvider {
  readonly id = "adzuna";
  constructor(
    private readonly appId: string,
    private readonly appKey: string,
    private readonly country = "gb",
    private readonly http: Fetch = fetch,
  ) {}

  async search({ keywords, location, page = 1 }: FeedQuery): Promise<FeedJob[]> {
    const params = new URLSearchParams({ app_id: this.appId, app_key: this.appKey, what: keywords, results_per_page: "30", "content-type": "application/json" });
    if (location) params.set("where", location);
    const res = await this.http(`https://api.adzuna.com/v1/api/jobs/${this.country}/search/${page}?${params}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`Adzuna ${res.status}`);
    const body = (await res.json()) as { results?: Record<string, unknown>[] };
    return (body.results ?? []).map((j) => {
      const company = (j.company as { display_name?: string } | undefined)?.display_name ?? "";
      const loc = (j.location as { display_name?: string } | undefined)?.display_name ?? "";
      return {
        externalId: `adzuna:${String(j.id)}`,
        source: "Adzuna",
        title: stripHtml(String(j.title ?? "")),
        company,
        location: loc,
        remote: /remote/i.test(`${String(j.title ?? "")} ${loc}`),
        salary: money(j.salary_min as number | null, j.salary_max as number | null),
        url: String(j.redirect_url ?? ""),
        description: stripHtml(String(j.description ?? "")),
        postedAt: j.created ? new Date(String(j.created)).toISOString() : null,
      };
    });
  }

  /** Salary distribution for a role (and place), when Adzuna has enough data. */
  async salaryRange(what: string, where?: string): Promise<{ p25: number; median: number; p75: number; samples: number } | null> {
    const params = new URLSearchParams({ app_id: this.appId, app_key: this.appKey, what, "content-type": "application/json" });
    if (where) params.set("where", where);
    const res = await this.http(`https://api.adzuna.com/v1/api/jobs/${this.country}/histogram?${params}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    const body = (await res.json()) as { histogram?: Record<string, number> };
    return percentiles(body.histogram ?? {});
  }
}

/** p25 / median / p75 from a histogram of { bucketStart: count }. */
export function percentiles(histogram: Record<string, number>): { p25: number; median: number; p75: number; samples: number } | null {
  const buckets = Object.entries(histogram)
    .map(([k, n]) => [Number(k), n] as const)
    .filter(([k, n]) => Number.isFinite(k) && n > 0)
    .sort((a, b) => a[0] - b[0]);
  const samples = buckets.reduce((s, [, n]) => s + n, 0);
  if (samples < 10) return null;
  const at = (p: number) => {
    let seen = 0;
    for (const [k, n] of buckets) {
      seen += n;
      if (seen >= samples * p) return k;
    }
    return buckets.at(-1)![0];
  };
  return { p25: at(0.25), median: at(0.5), p75: at(0.75), samples };
}

/**
 * The highest yearly figure in a salary text ("$170k - $200k" → 200000), or null when there is
 * none or it isn't yearly pay (hourly, per task, monthly). Used to drop jobs below a minimum.
 */
export function salaryCeiling(text: string): number | null {
  if (!text || /(per|an?|\/)\s*(hour|hr|task|day|week|month)|hourly|daily|monthly/i.test(text)) return null;
  const nums = [...text.matchAll(/(\d[\d,.]*)\s*(k)?/gi)].map((m) => {
    const n = Number(m[1]!.replace(/,/g, ""));
    return m[2] ? n * 1000 : n;
  });
  const max = Math.max(0, ...nums.filter(Number.isFinite));
  return max >= 1000 ? max : null;
}

/** Keeps jobs that pay at least `min`, and jobs that don't say. */
export const meetsSalary = (job: { salary: string }, min: number | null | undefined) => {
  if (!min) return true;
  const top = salaryCeiling(job.salary);
  return top === null || top >= min;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Asks every provider, keeps going when one fails, removes duplicates, newest first. */
export class JobFeed {
  constructor(
    readonly providers: JobFeedProvider[],
    private readonly onError: (provider: string, error: unknown) => void = () => {},
    private readonly timeoutMs = 10_000,
  ) {}

  /**
   * Starts filling the providers' caches (the company boards take a while on a cold start), so
   * the first search is fast. Fire and forget; failures go to onError.
   */
  warm(): void {
    for (const p of this.providers) p.warm?.().catch((e: unknown) => this.onError(p.id, e));
  }

  async search(query: FeedQuery): Promise<FeedJob[]> {
    // A slow provider doesn't hold the page: it's skipped this time and its cache keeps filling.
    const within = <T,>(promise: Promise<T>, ms: number) =>
      Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms).unref?.())]);
    const results = await Promise.all(
      this.providers.map((p) =>
        within(p.search(query), this.timeoutMs).catch((e: unknown) => {
          this.onError(p.id, e);
          return [] as FeedJob[];
        }),
      ),
    );
    const seen = new Set<string>();
    const out: FeedJob[] = [];
    for (const job of results.flat()) {
      if (!job.title || !job.url) continue;
      const key = `${norm(job.title)}|${norm(job.company)}`;
      const link = job.url.replace(/^https?:\/\/(www\.)?/i, "").replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
      if (seen.has(key) || seen.has(link)) continue;
      seen.add(key);
      seen.add(link);
      if (query.remote && !job.remote) continue;
      out.push(job);
    }
    return out.sort((a, b) => (b.postedAt ?? "").localeCompare(a.postedAt ?? ""));
  }
}

export const JOB_FEED = Symbol.for("cvb.JobFeed");

export type JobFeedConfig = {
  JOOBLE_API_KEY?: string;
  ADZUNA_APP_ID?: string;
  ADZUNA_APP_KEY?: string;
  ADZUNA_COUNTRY?: string;
  HIMALAYAS_API_KEY?: string;
  /** Company career boards to follow ("greenhouse:gitlab, ashby:ramp=Ramp"); unset = defaults, "none" = off. */
  JOBFEED_COMPANIES?: string;
};

/**
 * Builds the feed from configuration. Order matters for duplicates: company career boards come
 * first (the original posting), then the free remote boards, then the aggregators.
 */
export function createJobFeed(config: JobFeedConfig, onError?: (p: string, e: unknown) => void): JobFeed {
  const providers: JobFeedProvider[] = [];
  const spec = config.JOBFEED_COMPANIES?.trim();
  if (spec !== "none") {
    const boards = parseBoards(spec || DEFAULT_BOARDS);
    if (boards.length) providers.push(new CompanyBoardsProvider(boards, fetch, (board, e) => onError?.(`companies/${board}`, e)));
  }
  providers.push(new HimalayasProvider(config.HIMALAYAS_API_KEY ?? ""), new RemotiveProvider(), new ArbeitnowProvider(), new RemoteOkProvider());
  if (config.JOOBLE_API_KEY) providers.push(new JoobleProvider(config.JOOBLE_API_KEY));
  if (config.ADZUNA_APP_ID && config.ADZUNA_APP_KEY) providers.push(new AdzunaProvider(config.ADZUNA_APP_ID, config.ADZUNA_APP_KEY, config.ADZUNA_COUNTRY || "gb"));
  return new JobFeed(providers, onError);
}
