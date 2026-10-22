/**
 * Public usage numbers for the landing page. Only real counts, and only once they are big
 * enough to mean something: below a threshold a number is withheld (null) and the page shows
 * nothing, rather than a small figure or an invented one.
 */

export type RawStats = {
  /** CVs saved to accounts in the last 7 days (not counting deleted ones). */
  cvsLast7Days: number;
  /** All CVs saved to accounts (not counting deleted ones). */
  cvsTotal: number;
  /** PDF downloads recorded by product analytics in the last 7 days, when tracked. */
  pdfsLast7Days: number | null;
  /** All PDF downloads recorded by product analytics, when tracked. */
  pdfsTotal: number | null;
};

export type PublicStats = { [K in keyof RawStats]: number | null };

/** The smallest number worth showing for each figure. */
export const STATS_THRESHOLDS: Record<keyof RawStats, number> = {
  cvsLast7Days: 100,
  cvsTotal: 1000,
  pdfsLast7Days: 100,
  pdfsTotal: 1000,
};

/** Rounds down so a shown figure is never more than the real one ("1,240" → 1,200, shown as "1,200+"). */
export function roundDownForDisplay(n: number): number {
  const v = Math.max(0, Math.floor(n));
  const step = v < 1_000 ? 10 : v < 10_000 ? 100 : v < 100_000 ? 1_000 : 10_000;
  return Math.floor(v / step) * step;
}

/** Withholds every figure under its threshold and rounds the rest down. */
export function publicStats(raw: RawStats): PublicStats {
  const out = {} as PublicStats;
  for (const key of Object.keys(STATS_THRESHOLDS) as (keyof RawStats)[]) {
    const n = raw[key];
    out[key] = n !== null && Number.isFinite(n) && n >= STATS_THRESHOLDS[key] ? roundDownForDisplay(n) : null;
  }
  return out;
}

/**
 * Whether the landing shows a stats line at all: only while this week's CV count passes its
 * threshold, so the line never shows a stale total for a product nobody uses any more.
 */
export const showStatsLine = (stats: PublicStats | null | undefined): boolean => stats?.cvsLast7Days != null;
