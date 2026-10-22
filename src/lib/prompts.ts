import { clean } from "./cv";
import type { CV, Experience, Project } from "./types";

/* All prompts insist on never inventing facts: the CV must stay truthful. */

const HONEST =
  "Never invent employers, dates, numbers, degrees, tools or achievements that are not in the input. " +
  "If something is missing, leave it out.";

/* ------------------------------------------------------------------ Extraction */

const str = { type: "string" };
const strArr = { type: "array", items: str };

export const CV_SCHEMA = {
  type: "object",
  properties: {
    personal: {
      type: "object",
      properties: {
        name: str,
        headline: str,
        email: str,
        phone: str,
        location: str,
        website: str,
        linkedin: str,
        github: str,
      },
      required: ["name", "headline", "email", "phone", "location", "website", "linkedin", "github"],
    },
    summary: str,
    experience: {
      type: "array",
      items: {
        type: "object",
        properties: { role: str, company: str, location: str, date: str, bullets: strArr, stack: str },
        required: ["role", "company", "location", "date", "bullets", "stack"],
      },
    },
    education: {
      type: "array",
      items: {
        type: "object",
        properties: { degree: str, school: str, date: str, details: str },
        required: ["degree", "school", "date", "details"],
      },
    },
    skills: {
      type: "array",
      items: { type: "object", properties: { category: str, items: str }, required: ["category", "items"] },
    },
    projects: {
      type: "array",
      items: {
        type: "object",
        properties: { name: str, date: str, links: strArr, bullets: strArr, stack: str },
        required: ["name", "date", "links", "bullets", "stack"],
      },
    },
    certificates: {
      type: "array",
      items: { type: "object", properties: { name: str, issuer: str, year: str }, required: ["name", "issuer", "year"] },
    },
    languages: {
      type: "array",
      items: { type: "object", properties: { name: str, level: str }, required: ["name", "level"] },
    },
  },
  required: ["personal", "summary", "experience", "education", "skills", "projects", "certificates", "languages"],
};

export function extractPrompt(text: string) {
  return {
    system:
      "You convert the text of a CV/resume into structured JSON. Copy the person's own wording; do not rewrite or summarise. " +
      "Put each achievement or responsibility as a separate bullet. Use empty strings or empty arrays for anything not present. " +
      "Group skills into categories when the CV does; otherwise use one category named \"Skills\". " +
      "Fill a job's \"stack\" only when the CV lists tools for that specific job; otherwise leave it empty. " +
      "Languages (English, Urdu…) go in languages, not skills. " +
      HONEST,
    prompt: `CV text:\n"""\n${text.slice(0, 14000)}\n"""`,
  };
}

/* ------------------------------------------------------------------ Writing */

function context(cv: CV): string {
  const p = cv.personal;
  const jobs = cv.experience
    .map((e) => `- ${e.role} at ${e.company} (${e.date}): ${clean(e.bullets).join("; ")}`)
    .join("\n");
  const projects = cv.projects.map((pr) => `- ${pr.name}: ${clean(pr.bullets).join("; ")}`).join("\n");
  const skills = cv.skills.map((s) => `${s.category}: ${s.items}`).join("; ");
  const edu = cv.education.map((e) => `${e.degree}, ${e.school} (${e.date})`).join("; ");
  return [
    `Target job title: ${p.headline || "not given"}`,
    jobs && `Experience:\n${jobs}`,
    projects && `Projects:\n${projects}`,
    skills && `Skills: ${skills}`,
    edu && `Education: ${edu}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function summaryPrompt(cv: CV) {
  const current = cv.summary.trim();
  return {
    system:
      "You are an expert CV writer. Write a professional summary for the top of a CV: 3 to 4 sentences, 50 to 80 words, " +
      "third person without pronouns (no 'I', no name), concrete and specific, no clichés like 'hard-working' or 'passionate'. " +
      "Mention the target role, years or level of experience if known, core skills and the kind of work the person does. " +
      HONEST +
      " Reply with the summary text only.",
    prompt: current
      ? `Improve this summary using the details below.\n\nCurrent summary:\n${current}\n\n${context(cv)}`
      : `Write a summary from these details.\n\n${context(cv)}`,
  };
}

export function bulletsPrompt(item: Experience | Project, cv: CV) {
  const title = "role" in item ? `${item.role} at ${item.company}` : `Project: ${item.name}`;
  const lines = clean(item.bullets);
  return {
    system:
      "You are an expert CV writer. Rewrite CV achievement lines so they are strong and easy to scan: start each with a past-tense action verb " +
      "(Built, Led, Designed, Reduced…), keep each under 25 words, show impact and keep any numbers that are given. " +
      "Keep the same facts and roughly the same number of lines. " +
      HONEST +
      " Reply with one line per achievement and nothing else: no intro, no numbering.",
    prompt:
      `${title}\nTarget job title: ${cv.personal.headline || "not given"}\nTools: ${item.stack || "not given"}\n\n` +
      (lines.length ? `Lines to improve:\n${lines.join("\n")}` : "There are no lines yet. Write 3 short lines based only on the title and tools, keeping them general."),
  };
}

/* ------------------------------------------------------------------ Tailoring */

export const TAILOR_SCHEMA = {
  type: "object",
  properties: {
    summary: str,
    missingKeywords: strArr,
    tips: strArr,
  },
  required: ["summary", "missingKeywords", "tips"],
};

export function tailorPrompt(cv: CV, jobAd: string) {
  return {
    system:
      "You help a candidate tailor their CV to a job advert for applicant tracking systems (ATS). " +
      "Return JSON with: summary — a rewritten 3–4 sentence CV summary (50–80 words, no pronouns) that uses the advert's key terms " +
      "where the candidate genuinely has them; missingKeywords — up to 10 important skills or terms from the advert that the CV does not show; " +
      "tips — up to 4 short, specific suggestions for changes to the CV. " +
      HONEST,
    prompt: `Job advert:\n"""\n${jobAd.slice(0, 6000)}\n"""\n\nCandidate CV:\nCurrent summary: ${cv.summary}\n\n${context(cv)}`,
  };
}
