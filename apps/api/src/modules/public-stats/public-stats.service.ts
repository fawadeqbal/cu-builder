import type { PublicStatsDto } from "@cvb/contracts";
import { publicStats } from "@cvb/domain";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { PUBLIC_STATS_REPOSITORY, type PublicStatsRepository } from "./public-stats.repository.js";

export const STATS_CACHE_MS = 10 * 60_000;
const WEEK_MS = 7 * 24 * 60 * 60_000;

/**
 * Real usage numbers for the landing page, cached for ten minutes. Figures under their
 * threshold come back as null (see `publicStats` in the domain), so small numbers never leak.
 */
@Injectable()
export class PublicStatsService {
  private readonly logger = new Logger(PublicStatsService.name);
  private cache: { at: number; value: PublicStatsDto } | null = null;
  private pending: Promise<PublicStatsDto> | null = null;

  constructor(
    @Inject(PUBLIC_STATS_REPOSITORY) private readonly repo: PublicStatsRepository,
    private readonly clock: () => number = Date.now,
  ) {}

  async get(): Promise<PublicStatsDto> {
    if (this.cache && this.clock() - this.cache.at < STATS_CACHE_MS) return this.cache.value;
    // One query batch at a time, however many visitors arrive while it runs.
    this.pending ??= this.load().finally(() => (this.pending = null));
    return this.pending;
  }

  private async load(): Promise<PublicStatsDto> {
    const since = new Date(this.clock() - WEEK_MS);
    try {
      const [cvsLast7Days, cvsTotal, pdfsLast7Days, pdfsTotal] = await Promise.all([
        this.repo.countResumes(since),
        this.repo.countResumes(),
        this.repo.countEvents("pdf_downloaded", since),
        this.repo.countEvents("pdf_downloaded"),
      ]);
      const value = publicStats({ cvsLast7Days, cvsTotal, pdfsLast7Days, pdfsTotal });
      this.cache = { at: this.clock(), value };
      return value;
    } catch (err) {
      // Numbers are a nice-to-have: show none rather than fail the page.
      this.logger.warn(`Public stats unavailable: ${(err as Error).message}`);
      return this.cache?.value ?? { cvsLast7Days: null, cvsTotal: null, pdfsLast7Days: null, pdfsTotal: null };
    }
  }
}
