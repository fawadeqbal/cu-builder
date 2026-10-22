import type { ApplicationDto, FeedJobDto, FeedQueryDto, JobPreferencesDto, SaveFeedJobDto } from "@cvb/contracts";
import { DB } from "@cvb/db/nest";
import type { DbClient } from "@cvb/db";
import { matchJob, normalizeCV, type CV } from "@cvb/domain";
import { AdzunaProvider, JOB_FEED, meetsSalary, type FeedJob, type JobFeed } from "@cvb/jobfeed";
import { Inject, Injectable } from "@nestjs/common";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { TrackerService } from "../tracker/tracker.service.js";

const CACHE_MS = 10 * 60_000;
const CACHE_MAX = 200;
const RESULTS = 50;

const DEFAULT_PREFS: JobPreferencesDto = { titles: [], location: "", remote: false, salaryMin: null, alerts: "off", weeklyDigest: true };

/**
 * "Find jobs": searches the configured job boards, scores each posting against the person's
 * main CV, drops postings that state pay below their minimum, and marks the ones already in their tracker. Results are cached for ten minutes per
 * query so browsing doesn't hammer the providers (and stays inside their rate limits).
 */
@Injectable()
export class FeedService {
  private readonly cache = new Map<string, { at: number; jobs: FeedJob[] }>();

  constructor(
    @Inject(JOB_FEED) private readonly feed: JobFeed,
    @Inject(DB) private readonly db: DbClient,
    private readonly tracker: TrackerService,
  ) {}

  async search(user: AuthUser, query: FeedQueryDto): Promise<{ jobs: FeedJobDto[]; keywords: string; sources: string[] }> {
    const prefs = await this.preferences(user);
    const keywords = query.q?.trim() || prefs.titles[0] || (await this.mainCv(user.id))?.personal.headline || "";
    if (!keywords) return { jobs: [], keywords: "", sources: this.sources() };
    const location = query.location ?? prefs.location;
    const remote = query.q ? query.remote : query.remote || prefs.remote;
    const found = (await this.cached({ keywords, location: location || undefined, remote })).filter((j) => meetsSalary(j, prefs.salaryMin));
    const cv = await this.mainCv(user.id);
    const saved = await this.savedIds(user.id, found.map((j) => j.externalId));
    const jobs = found.slice(0, RESULTS).map((j) => ({
      ...j,
      score: cv ? matchJob(cv, { title: j.title, description: j.description }).score : null,
      saved: saved.has(j.externalId),
    }));
    return { jobs, keywords, sources: this.sources() };
  }

  /** Saves a posting to the tracker (first column), once. */
  save(user: AuthUser, dto: SaveFeedJobDto): Promise<ApplicationDto> {
    return this.tracker.create(
      user,
      {
        job: {
          title: dto.title,
          company: dto.company,
          location: dto.location,
          url: dto.url,
          description: dto.description,
          salary: dto.salary,
          remote: dto.remote,
          externalId: dto.externalId,
          source: "feed",
        },
      },
      "feed",
    );
  }

  async preferences(user: AuthUser): Promise<JobPreferencesDto> {
    const row = await this.db.jobPreferences.findUnique({ where: { userId: user.id } });
    if (!row) return DEFAULT_PREFS;
    return {
      titles: row.titles,
      location: row.location,
      remote: row.remote,
      salaryMin: row.salaryMin,
      alerts: row.alerts as JobPreferencesDto["alerts"],
      weeklyDigest: row.weeklyDigest,
    };
  }

  async savePreferences(user: AuthUser, dto: JobPreferencesDto): Promise<JobPreferencesDto> {
    const data = { ...dto, titles: [...new Set(dto.titles)] };
    await this.db.jobPreferences.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
    return this.preferences(user);
  }

  /** Market salary for a role, when a provider with salary data (Adzuna) is configured. */
  async salary(title: string, location?: string) {
    const adzuna = this.feed.providers.find((p): p is AdzunaProvider => p instanceof AdzunaProvider);
    if (!adzuna || !title.trim()) return null;
    const range = await adzuna.salaryRange(title, location).catch(() => null);
    return range && { ...range, source: "Adzuna" };
  }

  private sources(): string[] {
    return this.feed.providers.map((p) => p.id);
  }

  private async cached(q: { keywords: string; location?: string; remote: boolean }): Promise<FeedJob[]> {
    const key = JSON.stringify([q.keywords.toLowerCase(), (q.location ?? "").toLowerCase(), q.remote]);
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.jobs;
    const jobs = await this.feed.search(q);
    if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(key, { at: Date.now(), jobs });
    return jobs;
  }

  /** The CV used for match scores: the most recently edited one that isn't a tailored copy. */
  private async mainCv(userId: string): Promise<CV | null> {
    const row = await this.db.resume.findFirst({
      where: { userId, deletedAt: null, archivedAt: null, baseResumeId: null },
      orderBy: { updatedAt: "desc" },
      select: { data: true },
    });
    return row ? normalizeCV(row.data) : null;
  }

  private async savedIds(userId: string, ids: string[]): Promise<Set<string>> {
    if (!ids.length) return new Set();
    const rows = await this.db.job.findMany({ where: { userId, deletedAt: null, externalId: { in: ids } }, select: { externalId: true } });
    return new Set(rows.map((r) => r.externalId!));
  }
}
