import { emptyCV, type CV } from "@cvb/domain";

/** What the summary generator asks for. Everything except the job title is optional. */
export type SummaryFields = {
  targetTitle: string;
  role: string;
  company: string;
  years: string;
  skills: string;
  highlights: string;
};

export const EMPTY_SUMMARY_FIELDS: SummaryFields = { targetTitle: "", role: "", company: "", years: "", skills: "", highlights: "" };

const lines = (s: string) =>
  s
    .split(/\n+/)
    .map((l) => l.replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 10);

/**
 * A small CV built from the generator's fields, so the summary endpoint (which writes from a CV)
 * only has the person's own facts to work with. Years go into the notes the AI reads, so its
 * number guard accepts them; any other number it writes becomes a [number] placeholder.
 */
export function summaryToolCv(f: SummaryFields): CV {
  const title = f.targetTitle.trim();
  const role = f.role.trim() || title;
  const years = f.years.trim();
  const skills = f.skills.trim();
  const hasJob = Boolean(f.role.trim() || f.company.trim() || f.highlights.trim());
  return {
    ...emptyCV,
    personal: { ...emptyCV.personal, headline: title },
    summary: years ? `${years} years of experience as ${role}.` : "",
    experience: hasJob ? [{ id: "tool-job", role, company: f.company.trim(), location: "", date: "", bullets: lines(f.highlights), stack: "" }] : [],
    skills: skills ? [{ id: "tool-skills", category: "Skills", items: skills }] : [],
  };
}
