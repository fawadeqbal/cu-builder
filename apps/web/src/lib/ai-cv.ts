import { emptyCV, newId, type CV, type CvChange, type Language, type SkillGroup } from "@cvb/domain";

/**
 * Pure helpers for the two whole-CV AI flows ("Optimise my CV" in the editor and "Write a new CV
 * with AI" from My CVs): keeping requests and results inside the API's limits, turning rough notes
 * into lines when the AI can't help, and assembling a CV from the guided form.
 */

/** The resume schema's limits, so what we send back to the API always validates. */
const MAX_LINES = 30;
const MAX_LINE = 600;
const MAX_SKILL_ITEMS = 600;

export const clipLines = (lines: string[], max = MAX_LINES, len = MAX_LINE): string[] =>
  lines
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, max)
    .map((l) => l.slice(0, len));

/** Rough notes as CV lines, used as they are when the AI couldn't write them. */
export function notesToLines(notes: string): string[] {
  const lines = notes
    .split(/\n+/)
    .flatMap((l) => (l.length > 160 ? l.split(/(?<=[.;])\s+/) : [l]))
    .map((l) => l.replace(/^\s*(?:[-*•·–]|\d+[.)])\s*/, "").trim())
    .filter((l) => l.length > 1)
    .map((l) => l.charAt(0).toUpperCase() + l.slice(1));
  return clipLines(lines);
}

/** Splits a comma list into groups that each fit the schema's length. */
function chunkItems(items: string[], max = MAX_SKILL_ITEMS): string[] {
  const out: string[] = [];
  let cur = "";
  for (const it of items) {
    const next = cur ? `${cur}, ${it}` : it;
    if (next.length > max && cur) {
      out.push(cur);
      cur = it.slice(0, max);
    } else cur = next.slice(0, max);
  }
  if (cur) out.push(cur);
  return out;
}

const splitList = (text: string) =>
  text
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

/** Skills typed as free text, kept as one group (or a few, when long). */
export function skillsFromText(text: string): SkillGroup[] {
  return chunkItems(splitList(text)).map((items, i) => ({ id: newId("skill"), category: i === 0 ? "Skills" : "More skills", items }));
}

/**
 * Regrouped skills from the AI, reusing the existing groups' ids in order so the editor keeps its
 * place, and trimmed to the schema.
 */
export function regroupSkills(base: SkillGroup[], groups: { category: string; items: string }[]): SkillGroup[] {
  return groups
    .filter((g) => g.items.trim())
    .flatMap((g) => chunkItems(splitList(g.items)).map((items) => ({ category: g.category.trim().slice(0, 80) || "Skills", items })))
    .slice(0, 30)
    .map((g, i) => ({ id: base[i]?.id ?? newId("skill"), ...g }));
}

export const skillLines = (groups: SkillGroup[]): string[] =>
  groups.filter((g) => g.items.trim()).map((g) => (g.category.trim() ? `${g.category.trim()}: ${g.items.trim()}` : g.items.trim()));

/** The id of the one review row that replaces all skill groups (diffCV can't show removed groups). */
export const SKILLS_CHANGE = "skills.regroup";

export function skillsChange(base: SkillGroup[], next: SkillGroup[]): CvChange | null {
  const before = skillLines(base);
  const after = skillLines(next);
  if (JSON.stringify(before) === JSON.stringify(after)) return null;
  return { id: SKILLS_CHANGE, section: "skills", label: "Skills: regrouped", before: before.length ? before : null, after, target: { list: null, itemId: null, field: "skills" } };
}

/** Counts [placeholders] the AI left for the person to fill in. */
export const countPlaceholders = (values: (string | string[] | null)[]): number =>
  values.flat().reduce((n, v) => n + (v ? (v.match(/\[[^\]]+\]/g)?.length ?? 0) : 0), 0);

/** "English – fluent, Urdu – native" → language rows. */
export function parseLanguages(text: string): Language[] {
  return splitList(text)
    .slice(0, 20)
    .map((part) => {
      const m = part.match(/^(.+?)\s*(?:[–—:(]|\s-\s)\s*(.+?)\)?$/);
      const name = (m ? m[1]! : part).trim();
      const level = (m ? m[2]! : "").trim();
      return { id: newId("lang"), name: name.slice(0, 60), level: level ? (level.charAt(0).toUpperCase() + level.slice(1)).slice(0, 60) : "" };
    })
    .filter((l) => l.name);
}

/* ─── The guided "Write a new CV" form ───────────────────────────── */

export const LEVELS = [
  { value: "student", label: "Student" },
  { value: "entry", label: "Entry" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead" },
] as const;
export type Level = (typeof LEVELS)[number]["value"];

export type DraftJob = { key: string; role: string; company: string; location: string; date: string; notes: string };
export type DraftProject = { key: string; name: string; link: string; notes: string };
export type DraftEducation = { key: string; degree: string; school: string; date: string; details: string };

export type CvDraft = {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  link: string;
  level: Level;
  jobs: DraftJob[];
  projects: DraftProject[];
  education: DraftEducation[];
  skills: string;
  languages: string;
};

export const blankJob = (): DraftJob => ({ key: newId("job"), role: "", company: "", location: "", date: "", notes: "" });
export const blankProject = (): DraftProject => ({ key: newId("proj"), name: "", link: "", notes: "" });
export const blankEducation = (): DraftEducation => ({ key: newId("edu"), degree: "", school: "", date: "", details: "" });

const filled = (o: Record<string, string>) => Object.entries(o).some(([k, v]) => k !== "key" && v.trim());

/** The rows the person actually filled in (empty cards are ignored). */
export const usedJobs = (d: CvDraft) => d.jobs.filter(filled);
export const usedProjects = (d: CvDraft) => d.projects.filter(filled);
export const usedEducation = (d: CvDraft) => d.education.filter(filled);

export type DraftErrors = Record<string, string>;

/** Required fields, keyed by the input's id so the page can show the error and focus it. */
export function validateDraft(d: CvDraft): DraftErrors {
  const e: DraftErrors = {};
  if (!d.name.trim()) e.name = "Add your full name.";
  if (!d.title.trim()) e.title = "Add the job title you're aiming for, like Frontend Developer.";
  if (d.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) e.email = "Add the full address, like name@example.com.";
  for (const j of usedJobs(d)) if (!j.role.trim()) e[`job-${j.key}-role`] = "Add the job title for this job.";
  for (const p of usedProjects(d)) if (!p.name.trim()) e[`project-${p.key}-name`] = "Add the project's name.";
  for (const ed of usedEducation(d)) if (!ed.degree.trim() && !ed.school.trim()) e[`edu-${ed.key}-degree`] = "Add the degree or the school.";
  return e;
}

/** What the AI wrote, by draft row key (`skills` and `summary` for those parts). */
export type DraftResults = { bullets: Record<string, string[]>; skills: { category: string; items: string }[] | null; summary: string | null };

const isLinkedIn = (v: string) => /linkedin\.com/i.test(v);

/**
 * The CV from the form: AI lines where they were written, the person's own notes as lines where
 * they weren't. Nothing is added that the person didn't type.
 */
export function assembleCv(d: CvDraft, r: DraftResults): CV {
  const link = d.link.trim();
  const skills = r.skills ? regroupSkills([], r.skills) : [];
  return {
    ...structuredClone(emptyCV),
    personal: {
      ...emptyCV.personal,
      name: d.name.trim().slice(0, 120),
      headline: d.title.trim().slice(0, 160),
      email: d.email.trim().slice(0, 160),
      phone: d.phone.trim().slice(0, 60),
      location: d.location.trim().slice(0, 160),
      linkedin: isLinkedIn(link) ? link.slice(0, 240) : "",
      website: link && !isLinkedIn(link) ? link.slice(0, 240) : "",
    },
    summary: (r.summary ?? "").trim().slice(0, 3000),
    experience: usedJobs(d)
      .slice(0, 40)
      .map((j) => ({
        id: newId("exp"),
        role: j.role.trim().slice(0, 160),
        company: j.company.trim().slice(0, 160),
        location: j.location.trim().slice(0, 160),
        date: j.date.trim().slice(0, 80),
        bullets: clipLines(r.bullets[j.key] ?? notesToLines(j.notes)),
        stack: "",
      })),
    projects: usedProjects(d)
      .slice(0, 40)
      .map((p) => ({
        id: newId("proj"),
        name: p.name.trim().slice(0, 160),
        date: "",
        links: p.link.trim() ? [p.link.trim().slice(0, 240)] : [],
        bullets: clipLines(r.bullets[p.key] ?? notesToLines(p.notes)),
        stack: "",
      })),
    skills: skills.length ? skills : skillsFromText(d.skills),
    education: usedEducation(d)
      .slice(0, 20)
      .map((e) => ({
        id: newId("edu"),
        degree: e.degree.trim().slice(0, 160),
        school: e.school.trim().slice(0, 160),
        date: e.date.trim().slice(0, 80),
        details: e.details.trim().slice(0, 400),
      })),
    languages: parseLanguages(d.languages),
  };
}
