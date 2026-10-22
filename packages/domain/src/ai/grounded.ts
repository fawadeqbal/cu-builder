import { normalizeCV } from "../resume/model";
import type { CV } from "../resume/types";

/**
 * Keeps AI-read CVs honest. When AI reads an uploaded CV it must copy, not write: every value it
 * returns has to be found in the file's text. Small local models sometimes paraphrase or make
 * things up; anything that isn't backed by the source is dropped here.
 */

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^\p{L}\p{N}+#]+/u)
    .filter((w) => w.length > 1);

/** The source text prepared once for many checks. */
export function sourceIndex(text: string): { words: Set<string>; flat: string } {
  const list = words(text);
  return { words: new Set(list), flat: ` ${list.join(" ")} ` };
}

/**
 * True when `value` is backed by the source: at least `share` of its words appear there
 * (default 80%). Short values (one or two words) must appear as a phrase.
 */
export function isGrounded(value: string, source: { words: Set<string>; flat: string }, share = 0.8): boolean {
  const w = words(value);
  if (!w.length) return true;
  if (w.length <= 2) return source.flat.includes(` ${w.join(" ")} `) || w.every((x) => source.words.has(x));
  return w.filter((x) => source.words.has(x)).length / w.length >= share;
}

/**
 * Drops every value the source text doesn't back up, then fills contact details the AI missed
 * from the rule-based reading (`fallback`). Returns the cleaned CV and how many values were
 * dropped, so the import can warn the person to check.
 */
export function groundCv(input: CV, text: string, fallback?: CV): { cv: CV; dropped: number } {
  const src = sourceIndex(text);
  let dropped = 0;
  const keep = (v: string, share?: number) => {
    if (!v.trim() || isGrounded(v, src, share)) return v.trim();
    dropped++;
    return "";
  };
  const keepList = (list: string[]) => list.map((b) => keep(b)).filter(Boolean);
  const cv = normalizeCV(input);
  const p = cv.personal;
  const fp = fallback?.personal;
  const personal = Object.fromEntries(
    Object.entries(p).map(([k, v]) => [k, keep(v, 0.6) || (fp ? ((fp as Record<string, string>)[k] ?? "") : "")]),
  ) as CV["personal"];
  const out: CV = {
    ...cv,
    personal,
    summary: keep(cv.summary, 0.75),
    experience: cv.experience
      .map((e) => ({
        ...e,
        role: keep(e.role),
        company: keep(e.company),
        location: keep(e.location),
        date: keep(e.date, 0.5),
        bullets: keepList(e.bullets),
        stack: keep(e.stack, 0.6),
      }))
      .filter((e) => e.role || e.company || e.bullets.length),
    projects: cv.projects
      .map((pr) => ({
        ...pr,
        name: keep(pr.name),
        date: keep(pr.date, 0.5),
        links: pr.links.filter(
          (l) => text.includes(l.replace(/^https?:\/\//, "").replace(/\/$/, "")) || isGrounded(l, src),
        ),
        bullets: keepList(pr.bullets),
        stack: keep(pr.stack, 0.6),
      }))
      .filter((pr) => pr.name || pr.bullets.length),
    skills: cv.skills
      .map((s) => ({ ...s, category: s.category.trim(), items: keep(s.items, 0.6) }))
      .filter((s) => s.items),
    education: cv.education
      .map((e) => ({
        ...e,
        degree: keep(e.degree),
        school: keep(e.school),
        date: keep(e.date, 0.5),
        details: keep(e.details, 0.6),
      }))
      .filter((e) => e.degree || e.school),
    certificates: cv.certificates
      .map((c) => ({ ...c, name: keep(c.name), issuer: keep(c.issuer), year: keep(c.year, 0.5) }))
      .filter((c) => c.name),
    languages: cv.languages.map((l) => ({ ...l, name: keep(l.name), level: l.level.trim() })).filter((l) => l.name),
  };
  return { cv: out, dropped };
}
