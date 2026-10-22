/** The application tracker's rules: columns, ordering, reminders and progress stats. */

export type BoardColumn = { key: string; label: string };

export const DEFAULT_COLUMNS: BoardColumn[] = [
  { key: "saved", label: "Saved" },
  { key: "applied", label: "Applied" },
  { key: "interview", label: "Interview" },
  { key: "offer", label: "Offer" },
  { key: "rejected", label: "Rejected" },
];

/** Column keys that mean "this happened" for stats and dates. */
export const STAGE = { applied: "applied", interview: "interview", offer: "offer" } as const;

/** Slug for a new column name; unique among `existing`. */
export function columnKey(label: string, existing: string[]): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30) || "column";
  let key = base;
  for (let i = 2; existing.includes(key); i++) key = `${base}-${i}`;
  return key;
}

/** A position between two neighbours (fractional indexing), so a move updates one row. */
export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 1000;
  if (before === null) return after! - 1000;
  if (after === null) return before + 1000;
  return (before + after) / 2;
}

export type ReminderPlan = { kind: "follow_up" | "interview" | "deadline"; title: string; dueAt: Date };

const DAY = 24 * 3600 * 1000;

/**
 * Reminders an application should have, from its dates: follow up N days after applying
 * (if it is still "applied"), the day before an interview, and two days before a deadline.
 */
export function remindersFor(app: {
  status: string;
  company: string;
  title: string;
  appliedAt: Date | null;
  interviewAt: Date | null;
  deadlineAt: Date | null;
  followUpDays: number | null;
}): ReminderPlan[] {
  const out: ReminderPlan[] = [];
  const name = [app.title, app.company].filter(Boolean).join(" at ");
  if (app.appliedAt && app.followUpDays && app.status === STAGE.applied) {
    out.push({ kind: "follow_up", title: `Follow up on ${name}`, dueAt: new Date(app.appliedAt.getTime() + app.followUpDays * DAY) });
  }
  if (app.interviewAt) out.push({ kind: "interview", title: `Interview tomorrow: ${name}`, dueAt: new Date(app.interviewAt.getTime() - DAY) });
  if (app.deadlineAt) out.push({ kind: "deadline", title: `Deadline in 2 days: ${name}`, dueAt: new Date(app.deadlineAt.getTime() - 2 * DAY) });
  return out;
}

export type ProgressStats = { added: number; applied: number; interviews: number; offers: number; total: number };

/** The weekly progress email's numbers ("6 applications, 2 interviews"). */
export function progressSince(
  apps: { status: string; createdAt: Date; appliedAt: Date | null; interviewAt: Date | null; updatedAt: Date }[],
  since: Date,
): ProgressStats {
  const after = (d: Date | null) => !!d && d >= since;
  return {
    added: apps.filter((a) => after(a.createdAt)).length,
    applied: apps.filter((a) => after(a.appliedAt)).length,
    interviews: apps.filter((a) => after(a.interviewAt)).length,
    offers: apps.filter((a) => a.status === STAGE.offer && after(a.updatedAt)).length,
    total: apps.length,
  };
}
