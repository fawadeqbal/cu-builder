import { meetsSalary, type FeedJob } from "@cvb/jobfeed";

const DAY = 24 * 3600 * 1000;

export type AlertPrefs = { alerts: string; lastAlertAt: Date | null };

/** Daily alerts go out once a day, weekly ones once a week (with a little slack for schedule drift). */
export function alertDue(prefs: AlertPrefs, now: Date): boolean {
  if (prefs.alerts === "off") return false;
  if (!prefs.lastAlertAt) return true;
  const gap = now.getTime() - prefs.lastAlertAt.getTime();
  return prefs.alerts === "daily" ? gap >= 0.9 * DAY : gap >= 6.9 * DAY;
}

/** The window an alert covers: since the last alert, or one period back for the first one. */
export function alertSince(prefs: AlertPrefs, now: Date): Date {
  if (prefs.lastAlertAt) return prefs.lastAlertAt;
  return new Date(now.getTime() - (prefs.alerts === "weekly" ? 7 : 1) * DAY);
}

/** New, unsaved postings, best matches first; jobs without a date count as new only once (by id). */
export function pickAlertJobs(
  jobs: FeedJob[],
  opts: { since: Date; saved: Set<string>; score: (job: FeedJob) => number | null; salaryMin?: number | null; limit?: number },
): (FeedJob & { score: number | null })[] {
  return jobs
    .filter((j) => !opts.saved.has(j.externalId) && meetsSalary(j, opts.salaryMin))
    .filter((j) => !j.postedAt || new Date(j.postedAt) > opts.since)
    .map((j) => ({ ...j, score: opts.score(j) }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || (b.postedAt ?? "").localeCompare(a.postedAt ?? ""))
    .slice(0, opts.limit ?? 10);
}
