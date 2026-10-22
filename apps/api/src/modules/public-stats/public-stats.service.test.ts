import { describe, expect, it } from "vitest";
import type { PublicStatsRepository } from "./public-stats.repository.js";
import { PublicStatsService, STATS_CACHE_MS } from "./public-stats.service.js";

/** Counts what it's asked and answers from fixed numbers. */
class FakeStats implements PublicStatsRepository {
  calls = 0;
  fail = false;
  constructor(public n: { week: number; total: number; pdfWeek: number; pdfTotal: number }) {}
  async countResumes(since?: Date) {
    this.calls++;
    if (this.fail) throw new Error("db down");
    return since ? this.n.week : this.n.total;
  }
  async countEvents(name: string, since?: Date) {
    expect(name).toBe("pdf_downloaded");
    return since ? this.n.pdfWeek : this.n.pdfTotal;
  }
}

describe("PublicStatsService", () => {
  it("hides numbers under the thresholds", async () => {
    const service = new PublicStatsService(new FakeStats({ week: 12, total: 80, pdfWeek: 30, pdfTotal: 90 }));
    expect(await service.get()).toEqual({ cvsLast7Days: null, cvsTotal: null, pdfsLast7Days: null, pdfsTotal: null });
  });

  it("returns rounded-down real counts once they pass", async () => {
    const service = new PublicStatsService(
      new FakeStats({ week: 1_234, total: 56_789, pdfWeek: 980, pdfTotal: 40_100 }),
    );
    expect(await service.get()).toEqual({
      cvsLast7Days: 1_200,
      cvsTotal: 56_000,
      pdfsLast7Days: 980,
      pdfsTotal: 40_000,
    });
  });

  it("asks for the last 7 days", async () => {
    const since: Date[] = [];
    const repo: PublicStatsRepository = {
      countResumes: async (s) => (s && since.push(s), 0),
      countEvents: async () => 0,
    };
    const now = Date.UTC(2026, 9, 22);
    await new PublicStatsService(repo, () => now).get();
    expect(since[0]!.getTime()).toBe(now - 7 * 24 * 3600_000);
  });

  it("caches for ten minutes and shares one load between callers", async () => {
    const repo = new FakeStats({ week: 500, total: 5_000, pdfWeek: 0, pdfTotal: 0 });
    let now = 0;
    const service = new PublicStatsService(repo, () => now);
    await Promise.all([service.get(), service.get(), service.get()]);
    expect(repo.calls).toBe(2); // one batch: this week + total
    now = STATS_CACHE_MS - 1;
    await service.get();
    expect(repo.calls).toBe(2);
    now = STATS_CACHE_MS + 1;
    repo.n.week = 700;
    expect((await service.get()).cvsLast7Days).toBe(700);
    expect(repo.calls).toBe(4);
  });

  it("falls back to the last numbers, or none, when the database fails", async () => {
    const repo = new FakeStats({ week: 500, total: 5_000, pdfWeek: 0, pdfTotal: 0 });
    let now = 0;
    const service = new PublicStatsService(repo, () => now);
    repo.fail = true;
    expect((await service.get()).cvsLast7Days).toBeNull();
    repo.fail = false;
    await service.get();
    now = STATS_CACHE_MS * 2;
    repo.fail = true;
    expect((await service.get()).cvsLast7Days).toBe(500);
  });
});
