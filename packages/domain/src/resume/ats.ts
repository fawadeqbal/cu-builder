import { wordCount } from "@cvb/shared";
import { clean } from "./model";
import type { CV, StepId } from "./types";

/**
 * ATS score and CV report: how well a CV survives applicant tracking systems and a recruiter's
 * first read. Pure and deterministic (no AI), so it is instant, free and testable. Every issue
 * points at the editor step (and item) that fixes it.
 */

export type AtsSectionId = "parsing" | "completeness" | "impact" | "length" | "readability" | "consistency";

export type AtsIssue = {
  id: string;
  section: AtsSectionId;
  /** What is wrong, in one sentence. */
  message: string;
  /** How to fix it, in one sentence. */
  fix: string;
  step: StepId;
  /** The list item to open, when the issue is about one entry. */
  itemId?: string;
  severity: "high" | "medium" | "low";
};

export type AtsSection = { id: AtsSectionId; label: string; score: number; max: number };

export type AtsReport = {
  score: number;
  grade: "excellent" | "good" | "fair" | "weak";
  sections: AtsSection[];
  issues: AtsIssue[];
  stats: { words: number; bullets: number; quantified: number; actionLed: number };
};

export type AtsInput = {
  /** The chosen template reads in plain order (single column, real text). */
  templateAts: boolean;
  /** Pages the CV fills, when the caller knows (the editor measures it). */
  pages?: number;
};

const SECTION_MAX: Record<AtsSectionId, number> = {
  parsing: 15,
  completeness: 25,
  impact: 25,
  length: 10,
  readability: 15,
  consistency: 10,
};

const LABELS: Record<AtsSectionId, string> = {
  parsing: "Parsing safety",
  completeness: "Completeness",
  impact: "Impact",
  length: "Length",
  readability: "Readability",
  consistency: "Consistency",
};

/** Strong verbs recruiters and ATS keyword lists favour. Lowercase, base or past form. */
export const ACTION_VERBS = new Set(
  (
    "achieved accelerated architected automated boosted built championed closed coached collaborated created cut decreased " +
    "delivered designed developed directed doubled drove eliminated enabled engineered established expanded generated grew " +
    "guided hired implemented improved increased introduced launched led managed mentored migrated modernised modernized " +
    "negotiated optimised optimized organised organized owned piloted planned produced published raised redesigned reduced " +
    "refactored resolved restructured revamped saved scaled secured shipped simplified spearheaded standardised standardized " +
    "streamlined strengthened supervised taught tested trained transformed tripled unified upgraded won wrote analysed analyzed " +
    "audited authored coordinated deployed facilitated forecast integrated maintained modelled modeled monitored presented " +
    "prototyped recruited researched reviewed supported translated validated wrote handled"
  ).split(/\s+/),
);

const WEAK_OPENERS = /^(responsible for|duties included|tasked with|worked on|helped( to)?|involved in|in charge of|assisted (with|in))\b/i;
const HAS_NUMBER = /(\d|\bone\b|\btwo\b|\bthree\b|\bfour\b|\bfive\b|\bten\b|\bhundred|\bthousand|\bmillion|%)/i;
const PRESENT = /\b(present|current|now|today)\b/i;
const YEAR = /\b(19|20)\d{2}\b/;

const firstWord = (s: string) => s.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? "";

export const isActionLed = (bullet: string): boolean => {
  const w = firstWord(bullet);
  return ACTION_VERBS.has(w) || (w.endsWith("ed") && w.length > 4 && !WEAK_OPENERS.test(bullet));
};

/** True when the line holds a real number; placeholders like [number] or [%] don't count until filled in. */
export const isQuantified = (bullet: string): boolean => HAS_NUMBER.test(bullet.replace(/\[[^\]]*\]/g, ""));

/** Which date style an entry uses, to spot mixed formats ("Jan 2024" vs "01/2024" vs "2024"). */
export function dateStyle(date: string): "month-name" | "numeric" | "year" | "other" | "none" {
  const d = date.trim();
  if (!d) return "none";
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(19|20)\d{2}/i.test(d)) return "month-name";
  if (/\b\d{1,2}[/.-](19|20)?\d{2,4}\b/.test(d)) return "numeric";
  if (YEAR.test(d)) return "year";
  return "other";
}

export function atsReport(cv: CV, input: AtsInput): AtsReport {
  const issues: AtsIssue[] = [];
  const add = (i: Omit<AtsIssue, "id">) => issues.push({ ...i, id: `${i.section}:${issues.length}` });
  const p = cv.personal;

  // Parsing safety ----------------------------------------------------------------------------
  let parsing = SECTION_MAX.parsing;
  if (!input.templateAts) {
    parsing -= 6;
    add({
      section: "parsing",
      severity: "medium",
      step: "finish",
      message: "This template uses columns or a sidebar, which some tracking systems read out of order.",
      fix: "For online applications, pick a template marked ATS.",
    });
  }
  const contactInHeader = [p.email, p.phone].filter((v) => v.trim()).length;
  if (contactInHeader === 0) {
    parsing -= 4;
    add({ section: "parsing", severity: "high", step: "personal", message: "No email or phone number to parse.", fix: "Add your email and phone number." });
  }
  const symbolHeavy = [p.name, p.headline].some((v) => /[^\p{L}\p{N}\s.,'&()/+-]/u.test(v));
  if (symbolHeavy) {
    parsing -= 2;
    add({ section: "parsing", severity: "low", step: "personal", message: "Your name or headline contains symbols or emoji.", fix: "Use plain letters so systems read them correctly." });
  }
  if (p.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email.trim())) {
    parsing -= 3;
    add({ section: "parsing", severity: "high", step: "personal", message: "Your email address doesn't look valid.", fix: "Check the email for typos." });
  }

  // Completeness ------------------------------------------------------------------------------
  let completeness = 0;
  const has = {
    name: !!p.name.trim(),
    headline: !!p.headline.trim(),
    contact: !!(p.email.trim() && (p.phone.trim() || p.location.trim())),
    summary: wordCount(cv.summary) >= 15,
    experience: cv.experience.some((e) => e.role.trim() && e.company.trim()),
    education: cv.education.some((e) => e.degree.trim() || e.school.trim()),
    skills: cv.skills.some((s) => s.items.trim()),
    links: !!(p.linkedin.trim() || p.website.trim() || p.github.trim()),
  };
  const weights = { name: 3, headline: 3, contact: 3, summary: 4, experience: 5, education: 3, skills: 3, links: 1 } as const;
  const missingText: Record<keyof typeof has, [string, string, StepId]> = {
    name: ["Your name is missing.", "Add your full name.", "personal"],
    headline: ["There is no job title under your name.", "Add the title you are applying for; it is the first keyword systems match.", "personal"],
    contact: ["Contact details are incomplete.", "Add a phone number or city next to your email.", "personal"],
    summary: ["The summary is missing or very short.", "Write 2–4 sentences with your role, years and strongest skills.", "summary"],
    experience: ["No job with both a title and a company.", "Add at least one role (internships and freelance count), or projects.", "experience"],
    education: ["Education is missing.", "Add your highest degree or diploma.", "education"],
    skills: ["No skills listed.", "List the tools and skills from the jobs you want.", "skills"],
    links: ["No LinkedIn, portfolio or GitHub link.", "Add one link recruiters can check.", "personal"],
  };
  for (const key of Object.keys(has) as (keyof typeof has)[]) {
    if (has[key]) completeness += weights[key];
    else {
      const [message, fix, step] = missingText[key];
      add({ section: "completeness", severity: weights[key] >= 4 ? "high" : "medium", step, message, fix });
    }
  }
  completeness = Math.round((completeness / 25) * SECTION_MAX.completeness);

  // Impact ------------------------------------------------------------------------------------
  const entries = [
    ...cv.experience.map((e) => ({ id: e.id, step: "experience" as StepId, name: e.role || e.company || "a job", bullets: clean(e.bullets) })),
    ...cv.projects.map((pr) => ({ id: pr.id, step: "projects" as StepId, name: pr.name || "a project", bullets: clean(pr.bullets) })),
  ];
  const bullets = entries.flatMap((e) => e.bullets);
  const quantified = bullets.filter(isQuantified).length;
  const actionLed = bullets.filter(isActionLed).length;
  let impact = 0;
  if (bullets.length) {
    impact += Math.round(Math.min(1, quantified / Math.max(1, bullets.length * 0.5)) * 13);
    impact += Math.round((actionLed / bullets.length) * 12);
  }
  for (const e of entries) {
    if (e.step === "experience" && e.bullets.length === 0) {
      add({ section: "impact", severity: "high", step: e.step, itemId: e.id, message: `No achievements listed for ${e.name}.`, fix: "Add 3–5 lines on what you did and what changed because of it." });
      continue;
    }
    if (e.bullets.length >= 2 && !e.bullets.some(isQuantified)) {
      add({ section: "impact", severity: "medium", step: e.step, itemId: e.id, message: `None of the lines for ${e.name} has a number.`, fix: "Add a count, percentage, time or money saved to at least one line." });
    }
    const weak = e.bullets.filter((b) => WEAK_OPENERS.test(b));
    if (weak.length) {
      add({ section: "impact", severity: "medium", step: e.step, itemId: e.id, message: `${weak.length} line${weak.length > 1 ? "s" : ""} for ${e.name} start with “responsible for” or similar.`, fix: "Start each line with an action verb like Built, Led or Reduced." });
    }
  }
  if (!bullets.length) {
    add({ section: "impact", severity: "high", step: "experience", message: "There are no achievement lines yet.", fix: "Add what you did in each job or project, one line each." });
  }

  // Length ------------------------------------------------------------------------------------
  const allText = [
    p.headline,
    cv.summary,
    ...bullets,
    ...cv.skills.map((s) => s.items),
    ...cv.education.map((e) => `${e.degree} ${e.school} ${e.details}`),
  ].join(" ");
  const words = wordCount(allText);
  let length = SECTION_MAX.length;
  if (words < 150) {
    length -= 6;
    add({ section: "length", severity: "medium", step: "experience", message: `Your CV has about ${words} words, which reads as thin.`, fix: "Aim for 300–700 words: more detail on your recent roles." });
  } else if (words > 1000) {
    length -= 4;
    add({ section: "length", severity: "low", step: "experience", message: `Your CV has about ${words} words.`, fix: "Trim older roles to 2–3 lines so the recent ones stand out." });
  }
  if (input.pages && input.pages > 2) {
    length -= 4;
    add({ section: "length", severity: "medium", step: "finish", message: `It fills ${input.pages} pages.`, fix: "Keep it to one or two pages; use “Fit to one page” or shorten older entries." });
  }
  const summaryWords = wordCount(cv.summary);
  if (summaryWords > 120) {
    length -= 2;
    add({ section: "length", severity: "low", step: "summary", message: "The summary is longer than 120 words.", fix: "Cut it to the 3–4 strongest sentences." });
  }
  length = Math.max(0, length);

  // Readability -------------------------------------------------------------------------------
  let readability = SECTION_MAX.readability;
  const long = bullets.filter((b) => wordCount(b) > 35);
  if (long.length) {
    readability -= Math.min(6, long.length * 2);
    const owner = entries.find((e) => e.bullets.some((b) => wordCount(b) > 35));
    add({ section: "readability", severity: "low", step: owner?.step ?? "experience", itemId: owner?.id, message: `${long.length} line${long.length > 1 ? "s are" : " is"} longer than 35 words.`, fix: "Split long lines; one achievement per line reads faster." });
  }
  const firstPerson = [cv.summary, ...bullets].filter((t) => /\b(I|my|me)\b/.test(t)).length;
  if (firstPerson) {
    readability -= 3;
    add({ section: "readability", severity: "low", step: "summary", message: "Some lines use “I” or “my”.", fix: "Drop personal pronouns: “Led a team of 5”, not “I led a team of 5”." });
  }
  const shortSkills = cv.skills.some((s) => s.items.length > 0 && !/[,;·|\n]/.test(s.items) && wordCount(s.items) > 6);
  if (shortSkills) {
    readability -= 2;
    add({ section: "readability", severity: "low", step: "skills", message: "A skills group is written as a sentence.", fix: "Separate skills with commas so each one is matched." });
  }
  // Nothing written yet: there is little to call readable.
  if (!bullets.length && wordCount(cv.summary) < 15) readability = Math.round(readability * 0.3);
  readability = Math.max(0, readability);

  // Consistency -------------------------------------------------------------------------------
  let consistency = SECTION_MAX.consistency;
  const styles = new Set(
    [...cv.experience.map((e) => e.date), ...cv.education.map((e) => e.date)]
      .map(dateStyle)
      .filter((s) => s !== "none" && s !== "other"),
  );
  if (styles.size > 1) {
    consistency -= 4;
    add({ section: "consistency", severity: "low", step: "experience", message: "Dates are written in different styles.", fix: "Use one style everywhere, for example “Jan 2024 – Present”." });
  }
  const missingDates = cv.experience.filter((e) => (e.role.trim() || e.company.trim()) && !e.date.trim());
  if (missingDates.length) {
    consistency -= 3;
    add({ section: "consistency", severity: "medium", step: "experience", itemId: missingDates[0]?.id, message: `${missingDates.length} job${missingDates.length > 1 ? "s have" : " has"} no dates.`, fix: "Add start and end dates; gaps without dates raise questions." });
  }
  // Past roles described in present tense ("Manage", "Lead").
  const pastInPresent = cv.experience.filter(
    (e) => e.date.trim() && !PRESENT.test(e.date) && clean(e.bullets).some((b) => /^(manage|lead|build|develop|design|create|own|run|handle)s?\b/i.test(b.trim())),
  );
  if (pastInPresent.length) {
    consistency -= 3;
    add({ section: "consistency", severity: "low", step: "experience", itemId: pastInPresent[0]?.id, message: "A past role is written in the present tense.", fix: "Use past tense for past roles (Managed, Led) and present tense only for your current one." });
  }
  if (!cv.experience.length && !cv.education.length) consistency = Math.round(consistency * 0.3);
  consistency = Math.max(0, consistency);

  const sections: AtsSection[] = (
    [
      ["parsing", Math.max(0, parsing)],
      ["completeness", completeness],
      ["impact", impact],
      ["length", length],
      ["readability", readability],
      ["consistency", consistency],
    ] as const
  ).map(([id, score]) => ({ id, label: LABELS[id], score, max: SECTION_MAX[id] }));
  const score = Math.max(0, Math.min(100, sections.reduce((n, s) => n + s.score, 0)));
  const order = { high: 0, medium: 1, low: 2 } as const;
  issues.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    score,
    grade: score >= 85 ? "excellent" : score >= 70 ? "good" : score >= 50 ? "fair" : "weak",
    sections,
    issues,
    stats: { words, bullets: bullets.length, quantified, actionLed },
  };
}
