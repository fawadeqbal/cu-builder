import { atsReport } from "../resume/ats";
import type { CV } from "../resume/types";

/** What the dashboard knows about one student. */
export type StudentInput = {
  userId: string;
  name: string;
  email: string;
  cohort: string;
  role: string;
  /** Their CVs (not tailored copies), newest first. */
  resumes: { id: string; cv: CV; templateAts: boolean; updatedAt: Date }[];
  applications: { status: string; appliedAt: Date | null; interviewAt: Date | null; updatedAt: Date }[];
  lastActiveAt: Date | null;
};

export type StudentRow = {
  userId: string;
  name: string;
  email: string;
  cohort: string;
  cvs: number;
  /** The CV with the best ATS score, for the reviewer link. */
  bestResumeId: string | null;
  bestAts: number | null;
  applications: number;
  interviews: number;
  offers: number;
  placed: boolean;
  lastActiveAt: string | null;
};

export type CohortMetrics = {
  students: number;
  withCv: number;
  withCvPct: number;
  avgAts: number | null;
  applications: number;
  interviews: number;
  offers: number;
  placed: number;
  placedPct: number;
  /** Students active in the last 30 days. */
  active30: number;
};

const OFFER = new Set(["offer", "accepted", "hired", "placed"]);
const INTERVIEW = new Set(["interview", "interviewing", "phone-screen", "assessment"]);

/** One row per student: CVs, best ATS score, applications and outcomes. */
export function studentRow(s: StudentInput): StudentRow {
  let best: { id: string; score: number } | null = null;
  for (const r of s.resumes) {
    const score = atsReport(r.cv, { templateAts: r.templateAts }).score;
    if (!best || score > best.score) best = { id: r.id, score };
  }
  const offers = s.applications.filter((a) => OFFER.has(a.status)).length;
  return {
    userId: s.userId,
    name: s.name,
    email: s.email,
    cohort: s.cohort,
    cvs: s.resumes.length,
    bestResumeId: best?.id ?? null,
    bestAts: best?.score ?? null,
    applications: s.applications.length,
    interviews: s.applications.filter((a) => a.interviewAt || INTERVIEW.has(a.status) || OFFER.has(a.status)).length,
    offers,
    placed: s.applications.some((a) => a.status === "accepted" || a.status === "hired" || a.status === "placed") || offers > 0,
    lastActiveAt: s.lastActiveAt?.toISOString() ?? null,
  };
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

export function cohortMetrics(rows: StudentRow[], now: Date = new Date()): CohortMetrics {
  const scored = rows.filter((r) => r.bestAts !== null);
  const placed = rows.filter((r) => r.placed).length;
  const withCv = rows.filter((r) => r.cvs > 0).length;
  const since = now.getTime() - 30 * 86_400_000;
  return {
    students: rows.length,
    withCv,
    withCvPct: pct(withCv, rows.length),
    avgAts: scored.length ? Math.round(scored.reduce((n, r) => n + r.bestAts!, 0) / scored.length) : null,
    applications: rows.reduce((n, r) => n + r.applications, 0),
    interviews: rows.reduce((n, r) => n + r.interviews, 0),
    offers: rows.reduce((n, r) => n + r.offers, 0),
    placed,
    placedPct: pct(placed, rows.length),
    active30: rows.filter((r) => r.lastActiveAt && new Date(r.lastActiveAt).getTime() >= since).length,
  };
}
