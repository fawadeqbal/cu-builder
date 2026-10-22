/**
 * More job sources, all free and public:
 * - Himalayas (remote jobs, searchable; optional free key for a higher limit),
 * - Arbeitnow (jobs from company hiring systems, Europe-leaning, hourly snapshot),
 * - RemoteOK (latest ~100 remote jobs, snapshot),
 * - company career boards on Greenhouse, Lever, Ashby and SmartRecruiters (first-hand postings).
 *
 * Snapshot sources have no search, so the whole list is fetched (cached) and filtered here with
 * `matchesQuery`. Every job keeps its source name and its original link: the sources ask to be
 * credited and linked back to, and their jobs must not be passed on to other job boards.
 */
import { stripHtml, type FeedJob, type FeedQuery, type JobFeedProvider } from "./core";

type Fetch = typeof fetch;

const UA = { "user-agent": "CV Builder job feed (+https://github.com/fawadeqbal/cu-builder)", accept: "application/json" };

/**
 * A tiny time-based cache with in-flight sharing (a burst of searches makes one request) and
 * stale-while-revalidate (after the TTL the old data is served while fresh data loads).
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, { at: number; value: Promise<T>; last?: T }>();
  constructor(private readonly ttlMs: number) {}

  get(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key);
    if (hit && Date.now() - hit.at < this.ttlMs) return hit.value;
    const entry: { at: number; value: Promise<T>; last?: T } = { at: Date.now(), value: load(), last: hit?.last };
    this.entries.set(key, entry);
    entry.value.then(
      (v) => void (entry.last = v),
      // A failed load isn't kept: the next search tries again (and still gets the last good data).
      () => void (this.entries.get(key) === entry && (entry.at = 0)),
    );
    return entry.last !== undefined ? Promise.resolve(entry.last) : entry.value;
  }
}

const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .map((w) => w.replace(/^\.+|\.+$/g, ""))
    .filter((w) => w.length > 1);

/**
 * Local search for sources without one: every keyword must appear in the title (or in the tags),
 * or all of them in the description with at least one in the title. Location, when given,
 * must appear in the job's location unless the job is remote.
 */
export function matchesQuery(job: Pick<FeedJob, "title" | "description" | "location" | "remote"> & { tags?: string[] }, q: FeedQuery): boolean {
  const keys = words(q.keywords);
  if (!keys.length) return false;
  const title = new Set(words(`${job.title} ${(job.tags ?? []).join(" ")}`));
  const inTitle = keys.filter((k) => title.has(k)).length;
  let ok = inTitle === keys.length;
  if (!ok && inTitle > 0) {
    const body = new Set(words(job.description));
    ok = keys.every((k) => title.has(k) || body.has(k));
  }
  if (!ok) return false;
  if (q.location && !job.remote) return job.location.toLowerCase().includes(q.location.toLowerCase().trim());
  return true;
}

const iso = (v: unknown, unit: "s" | "ms" | "date" = "date"): string | null => {
  if (v === null || v === undefined || v === "") return null;
  const d = unit === "s" ? new Date(Number(v) * 1000) : unit === "ms" ? new Date(Number(v)) : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
const range = (min: unknown, max: unknown, currency = "") => {
  const a = Number(min) || 0;
  const b = Number(max) || 0;
  const c = currency ? `${currency} ` : "";
  if (a && b && a !== b) return `${c}${k(a)}–${k(b)}`;
  if (a || b) return `${c}${k(a || b)}`;
  return "";
};

const decodeEntities = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

async function getJson<T>(http: Fetch, url: string, timeoutMs: number, headers: Record<string, string> = {}): Promise<T> {
  const res = await http(url, { headers: { ...UA, ...headers }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return (await res.json()) as T;
}

const LIMIT = 40;

/* ─── Himalayas ───────────────────────────────────────────────────── */

/** Remote jobs from Himalayas' search API (credit Himalayas, keep its apply link unchanged). */
export class HimalayasProvider implements JobFeedProvider {
  readonly id = "himalayas";
  private readonly cache = new TtlCache<FeedJob[]>(60 * 60_000);
  constructor(
    private readonly apiKey = "",
    private readonly http: Fetch = fetch,
  ) {}

  search(q: FeedQuery): Promise<FeedJob[]> {
    const params = new URLSearchParams({ q: q.keywords, sort: "recent", page: String(q.page ?? 1) });
    return this.cache.get(params.toString(), async () => {
      const body = await getJson<{ jobs?: Record<string, unknown>[] }>(this.http, `https://himalayas.app/jobs/api/search?${params}`, 10_000, this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {});
      return (body.jobs ?? [])
        .map((j): FeedJob => {
          const places = Array.isArray(j.locationRestrictions) ? (j.locationRestrictions as string[]) : [];
          return {
            externalId: `himalayas:${String(j.guid ?? j.applicationLink)}`,
            source: "Himalayas",
            title: String(j.title ?? "").trim(),
            company: String(j.companyName ?? ""),
            location: places.length === 0 ? "Remote, worldwide" : places.length > 3 ? `Remote (${places.length} countries)` : `Remote: ${places.join(", ")}`,
            remote: true,
            salary: range(j.minSalary, j.maxSalary, String(j.currency ?? "")),
            url: String(j.applicationLink ?? j.guid ?? ""),
            description: stripHtml(String(j.description ?? j.excerpt ?? "")).slice(0, 8000),
            postedAt: iso(j.pubDate, "s"),
          };
        })
        .filter((j) => !q.location || /worldwide/i.test(j.location) || j.location.toLowerCase().includes(q.location.toLowerCase()));
    });
  }
}

/* ─── Arbeitnow ───────────────────────────────────────────────────── */

/** Arbeitnow's public job board API (no key; updated hourly; please link back to Arbeitnow). */
export class ArbeitnowProvider implements JobFeedProvider {
  readonly id = "arbeitnow";
  private readonly cache = new TtlCache<(FeedJob & { tags: string[] })[]>(60 * 60_000);
  constructor(
    private readonly pages = 3,
    private readonly http: Fetch = fetch,
  ) {}

  private all() {
    return this.cache.get("all", async () => {
      const out: (FeedJob & { tags: string[] })[] = [];
      for (let page = 1; page <= this.pages; page++) {
        const body = await getJson<{ data?: Record<string, unknown>[]; links?: { next?: string | null } }>(this.http, `https://www.arbeitnow.com/api/job-board-api?page=${page}`, 12_000);
        for (const j of body.data ?? []) {
          out.push({
            externalId: `arbeitnow:${String(j.slug)}`,
            source: "Arbeitnow",
            title: String(j.title ?? "").trim(),
            company: String(j.company_name ?? ""),
            location: String(j.location ?? ""),
            remote: j.remote === true,
            salary: "",
            url: String(j.url ?? ""),
            description: stripHtml(String(j.description ?? "")).slice(0, 8000),
            postedAt: iso(j.created_at, "s"),
            tags: Array.isArray(j.tags) ? (j.tags as string[]) : [],
          });
        }
        if (!body.links?.next) break;
      }
      return out;
    });
  }

  async search(q: FeedQuery): Promise<FeedJob[]> {
    return (await this.all())
      .filter((j) => matchesQuery(j, q))
      .slice(0, LIMIT)
      .map(({ tags: _tags, ...j }) => j);
  }
}

/* ─── RemoteOK ────────────────────────────────────────────────────── */

/** RemoteOK's public API: the latest ~100 remote jobs. Terms: credit Remote OK and link to each job. */
export class RemoteOkProvider implements JobFeedProvider {
  readonly id = "remoteok";
  private readonly cache = new TtlCache<(FeedJob & { tags: string[] })[]>(60 * 60_000);
  constructor(private readonly http: Fetch = fetch) {}

  private all() {
    return this.cache.get("all", async () => {
      const body = await getJson<Record<string, unknown>[]>(this.http, "https://remoteok.com/api", 12_000);
      // Element 0 is metadata (last update and the legal terms).
      return body.slice(1).map((j) => ({
        externalId: `remoteok:${String(j.id)}`,
        source: "Remote OK",
        title: String(j.position ?? "").trim(),
        company: String(j.company ?? ""),
        location: String(j.location ?? "") || "Remote",
        remote: true,
        salary: range(j.salary_min, j.salary_max, "USD"),
        url: String(j.url ?? j.apply_url ?? ""),
        description: stripHtml(String(j.description ?? "")).slice(0, 8000),
        postedAt: iso(j.date),
        tags: Array.isArray(j.tags) ? (j.tags as string[]) : [],
      }));
    });
  }

  async search(q: FeedQuery): Promise<FeedJob[]> {
    return (await this.all())
      .filter((j) => matchesQuery(j, q))
      .slice(0, LIMIT)
      .map(({ tags: _tags, ...j }) => j);
  }
}

/* ─── Company career boards ───────────────────────────────────────── */

export type AtsBoard = { ats: "greenhouse" | "lever" | "ashby" | "smartrecruiters"; slug: string; name?: string };

/**
 * Remote-friendly companies followed by default (all boards checked to exist). Override with
 * JOBFEED_COMPANIES, e.g. "greenhouse:gitlab, lever:spotify, ashby:ramp=Ramp", or "none".
 */
export const DEFAULT_BOARDS =
  "greenhouse:gitlab, greenhouse:cloudflare, greenhouse:datadog, greenhouse:figma, greenhouse:discord, greenhouse:stripe, greenhouse:elastic, greenhouse:grafanalabs, greenhouse:vercel, greenhouse:remote, greenhouse:mongodb, greenhouse:twilio, greenhouse:airbnb, " +
  "lever:palantir=Palantir, lever:spotify=Spotify, lever:mistral=Mistral AI, " +
  "ashby:ramp=Ramp, ashby:notion=Notion, ashby:linear=Linear, ashby:supabase=Supabase, ashby:posthog=PostHog, ashby:openai=OpenAI";

/** "greenhouse:gitlab, ashby:ramp=Ramp" → boards; unknown systems are ignored. */
export function parseBoards(spec: string): AtsBoard[] {
  return spec
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [left, name] = s.split("=");
      const [ats, slug] = (left ?? "").split(":").map((x) => x.trim());
      return { ats: ats as AtsBoard["ats"], slug: slug ?? "", name: name?.trim() || undefined };
    })
    .filter((b) => ["greenhouse", "lever", "ashby", "smartrecruiters"].includes(b.ats) && /^[\w.-]+$/.test(b.slug));
}

const titleCase = (slug: string) => slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const remoteText = (s: string) => /remote|anywhere|worldwide/i.test(s);

/** Fetches one company's public job board and maps it to feed jobs. */
async function fetchBoard(http: Fetch, b: AtsBoard): Promise<FeedJob[]> {
  const company = b.name ?? titleCase(b.slug);
  if (b.ats === "greenhouse") {
    const body = await getJson<{ jobs?: Record<string, unknown>[] }>(http, `https://boards-api.greenhouse.io/v1/boards/${b.slug}/jobs?content=true`, 20_000);
    return (body.jobs ?? []).map((j) => {
      const location = String((j.location as { name?: string } | undefined)?.name ?? "");
      return {
        externalId: `greenhouse:${b.slug}:${String(j.id)}`,
        source: "Greenhouse",
        title: String(j.title ?? "").trim(),
        company: String(j.company_name ?? "") || company,
        location,
        remote: remoteText(location),
        salary: "",
        url: String(j.absolute_url ?? ""),
        description: stripHtml(decodeEntities(String(j.content ?? ""))).slice(0, 8000),
        postedAt: iso(j.first_published ?? j.updated_at),
      };
    });
  }
  if (b.ats === "lever") {
    const body = await getJson<Record<string, unknown>[]>(http, `https://api.lever.co/v0/postings/${b.slug}?mode=json`, 20_000);
    return body.map((j) => {
      const cat = (j.categories ?? {}) as { location?: string; allLocations?: string[]; commitment?: string };
      const location = cat.location ?? (cat.allLocations ?? []).join(", ");
      return {
        externalId: `lever:${b.slug}:${String(j.id)}`,
        source: "Lever",
        title: String(j.text ?? "").trim(),
        company,
        location,
        remote: j.workplaceType === "remote" || remoteText(location),
        salary: "",
        url: String(j.hostedUrl ?? j.applyUrl ?? ""),
        description: `${String(j.descriptionPlain ?? "")}\n${String(j.additionalPlain ?? "")}`.trim().slice(0, 8000),
        postedAt: iso(j.createdAt, "ms"),
      };
    });
  }
  if (b.ats === "ashby") {
    const body = await getJson<{ jobs?: Record<string, unknown>[] }>(http, `https://api.ashbyhq.com/posting-api/job-board/${b.slug}?includeCompensation=true`, 20_000);
    return (body.jobs ?? [])
      .filter((j) => j.isListed !== false)
      .map((j) => {
        const extra = Array.isArray(j.secondaryLocations) ? (j.secondaryLocations as { location?: string }[]).map((l) => l.location).filter(Boolean) : [];
        const location = [String(j.location ?? ""), ...extra].filter(Boolean).join(" · ");
        return {
          externalId: `ashby:${b.slug}:${String(j.id)}`,
          source: "Ashby",
          title: String(j.title ?? "").trim(),
          company,
          location,
          remote: j.isRemote === true || j.workplaceType === "Remote" || remoteText(location),
          salary: String((j.compensation as { compensationTierSummary?: string } | undefined)?.compensationTierSummary ?? ""),
          url: String(j.jobUrl ?? j.applyUrl ?? ""),
          description: String(j.descriptionPlain ?? "").slice(0, 8000),
          postedAt: iso(j.publishedAt),
        };
      });
  }
  const body = await getJson<{ content?: Record<string, unknown>[] }>(http, `https://api.smartrecruiters.com/v1/companies/${b.slug}/postings?limit=100`, 20_000);
  return (body.content ?? []).map((j) => {
    const loc = (j.location ?? {}) as { fullLocation?: string; city?: string; country?: string; remote?: boolean };
    const location = loc.fullLocation ?? [loc.city, loc.country].filter(Boolean).join(", ");
    return {
      externalId: `smartrecruiters:${b.slug}:${String(j.id)}`,
      source: "SmartRecruiters",
      title: String(j.name ?? "").trim(),
      company: String((j.company as { name?: string } | undefined)?.name ?? "") || company,
      location,
      remote: loc.remote === true || remoteText(location),
      salary: "",
      url: `https://jobs.smartrecruiters.com/${b.slug}/${String(j.id)}`,
      description: "",
      postedAt: iso(j.releasedDate),
    };
  });
}

/**
 * First-hand postings from the career boards of followed companies (Greenhouse, Lever, Ashby,
 * SmartRecruiters public APIs: no key). Boards are fetched a few at a time and cached for an hour.
 */
export class CompanyBoardsProvider implements JobFeedProvider {
  readonly id = "companies";
  private readonly cache = new TtlCache<FeedJob[]>(60 * 60_000);
  constructor(
    readonly boards: AtsBoard[],
    private readonly http: Fetch = fetch,
    private readonly onError: (board: string, e: unknown) => void = () => {},
  ) {}

  warm(): Promise<FeedJob[]> {
    return this.all();
  }

  private all(): Promise<FeedJob[]> {
    return this.cache.get("all", async () => {
      const out: FeedJob[] = [];
      const queue = [...this.boards];
      const worker = async () => {
        for (let b = queue.shift(); b; b = queue.shift()) {
          const board = b;
          await fetchBoard(this.http, board).then(
            (jobs) => out.push(...jobs),
            (e: unknown) => this.onError(`${board.ats}:${board.slug}`, e),
          );
        }
      };
      await Promise.all(Array.from({ length: Math.min(6, queue.length) }, worker));
      return out;
    });
  }

  async search(q: FeedQuery): Promise<FeedJob[]> {
    return (await this.all())
      .filter((j) => j.title && j.url && matchesQuery(j, q))
      .sort((a, b) => (b.postedAt ?? "").localeCompare(a.postedAt ?? ""))
      .slice(0, LIMIT);
  }
}
