import { clean } from "./cv";
import { STEPS, type StepId } from "./steps";
import type { CV } from "./types";

const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export type CheckItem = { label: string; ok: boolean; step: StepId; hint: string };

/** What a recruiter-ready CV needs. Drives the CV check and the progress ring. */
export function cvChecks(cv: CV): CheckItem[] {
  const p = cv.personal;
  return [
    { label: "Name and contact details", ok: !!(p.name.trim() && p.email.trim()), step: "personal", hint: "Add your name and email" },
    { label: "Summary", ok: words(cv.summary) >= 15, step: "summary", hint: "Write 2–4 sentences" },
    {
      label: "Experience or projects",
      ok: cv.experience.some((e) => e.role.trim() || e.company.trim()) || cv.projects.some((pr) => pr.name.trim()),
      step: "experience",
      hint: "Add at least one job or project",
    },
    {
      label: "Achievements in your experience",
      ok: cv.experience.length === 0 || cv.experience.every((e) => clean(e.bullets).length > 0),
      step: "experience",
      hint: "Add a few lines to each job",
    },
    { label: "Education", ok: cv.education.some((e) => e.degree.trim() || e.school.trim()), step: "education", hint: "Add your degree" },
    { label: "Skills", ok: cv.skills.some((s) => s.items.trim()), step: "skills", hint: "List your key skills" },
  ];
}

/** Share of the CV check that passes, 0–1. */
export function cvStrength(cv: CV): number {
  const list = cvChecks(cv);
  return list.filter((c) => c.ok).length / list.length;
}

export type StepState = {
  /** The step has what it needs. */
  done: boolean;
  /** One short line about the step's content, shown under its name. */
  meta: string;
};

export function stepState(cv: CV, id: StepId): StepState {
  const optional = STEPS.find((s) => s.id === id)?.optional;
  const empty = { done: false, meta: optional ? "Optional" : "Not started" };
  switch (id) {
    case "personal": {
      const p = cv.personal;
      const missing = [p.name, p.headline, p.email].filter((v) => !v.trim()).length;
      if (missing === 3) return { done: false, meta: "Required" };
      return missing ? { done: false, meta: `${missing} required left` } : { done: true, meta: p.name.trim() };
    }
    case "summary": {
      const n = words(cv.summary);
      return n ? { done: n >= 15, meta: plural(n, "word") } : empty;
    }
    case "experience":
      return cv.experience.length ? { done: true, meta: plural(cv.experience.length, "job") } : empty;
    case "education":
      return cv.education.length ? { done: true, meta: plural(cv.education.length, "entry", "entries") } : empty;
    case "skills": {
      const n = cv.skills.filter((s) => s.items.trim()).length;
      return n ? { done: true, meta: plural(n, "group") } : empty;
    }
    case "projects":
      return cv.projects.length ? { done: true, meta: plural(cv.projects.length, "project") } : empty;
    case "extras": {
      const parts = [
        cv.languages.length && plural(cv.languages.length, "language"),
        cv.certificates.length && plural(cv.certificates.length, "certificate"),
      ].filter(Boolean);
      return parts.length ? { done: true, meta: parts.join(" · ") } : empty;
    }
    case "finish":
      return { done: false, meta: "Template and PDF" };
  }
}
