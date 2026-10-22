import { emptyCV, newId } from "./cv";
import type { CV } from "./types";

/**
 * Basic import without AI: finds contact details, the summary and the skills section with simple rules.
 * Everything else is left for the user (or the AI import) to fill in.
 */
const HEADINGS: Record<string, RegExp> = {
  summary: /^(summary|profile|professional summary|about( me)?|objective|career objective)$/i,
  experience: /^(experience|work experience|professional experience|employment( history)?|work history)$/i,
  education: /^(education|education and training|academic background|qualifications)$/i,
  skills: /^(skills|technical skills|core skills|key skills|skills & tools|competencies)$/i,
  projects: /^(projects|personal projects|selected projects)$/i,
  certificates: /^(certifications?|certificates|licenses)$/i,
  languages: /^(languages)$/i,
};

function headingOf(line: string): string | null {
  const t = line.replace(/[:|•]/g, "").trim();
  if (t.length > 40) return null;
  for (const [key, re] of Object.entries(HEADINGS)) if (re.test(t)) return key;
  return null;
}

const HEADING_WORDS =
  "ABOUT ME|PROFESSIONAL SUMMARY|SUMMARY|PROFILE|OBJECTIVE|WORK EXPERIENCE|PROFESSIONAL EXPERIENCE|EXPERIENCE|EMPLOYMENT HISTORY|" +
  "EDUCATION AND TRAINING|EDUCATION|TECHNICAL SKILLS|KEY SKILLS|SKILLS|PROJECTS|CERTIFICATIONS|CERTIFICATES|LANGUAGES";
const INLINE_HEADING = new RegExp(`^(${HEADING_WORDS})(?:\\s*:\\s*|\\s+)(.+)$`);

/** Splits lines like "ABOUT ME Full stack engineer…" (heading and text on one line) into two lines. */
function splitInlineHeadings(lines: string[]): string[] {
  return lines.flatMap((line) => {
    const m = line.match(INLINE_HEADING);
    return m ? [m[1], m[2]] : [line];
  });
}

export function basicParse(text: string): CV {
  const lines = splitInlineHeadings(text.split("\n").map((l) => l.trim()));
  const all = text;

  const email = all.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? "";
  const phone = all.match(/(\+?\d[\d\s().-]{7,}\d)/)?.[0]?.trim() ?? "";
  const linkedin = all.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+/i)?.[0] ?? "";
  const github = all.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+/i)?.[0] ?? "";
  const website =
    all
      .match(/(?:https?:\/\/)?(?:www\.)?[\w-]+\.(?:dev|io|me|com|net|org|site|app)(?:\/[\w-]*)?/gi)
      ?.find((u) => !/linkedin|github|gmail|yahoo|outlook|hotmail/i.test(u) && !email.includes(u)) ?? "";

  const firstLines = lines.filter(Boolean).slice(0, 4);
  const name =
    firstLines.find((l) => /^[\p{L}][\p{L} .'-]{2,40}$/u.test(l) && l.split(" ").length <= 5 && !headingOf(l)) ?? "";
  const headline =
    firstLines.find((l) => l !== name && l.length < 70 && !/@|\d{4}|http/.test(l) && !headingOf(l)) ?? "";

  // Split the text into sections by known headings.
  const sections: Record<string, string[]> = {};
  let current = "";
  for (const line of lines) {
    const h = headingOf(line);
    if (h) {
      current = h;
      sections[h] = [];
    } else if (current && line) {
      sections[current].push(line);
    }
  }

  const skillsText = (sections.skills ?? []).join(", ").replace(/\s*[•|·]\s*/g, ", ");

  return {
    ...emptyCV,
    personal: { ...emptyCV.personal, name, headline, email, phone, website, linkedin, github },
    summary: (sections.summary ?? []).join(" "),
    skills: skillsText ? [{ id: newId("skill"), category: "Skills", items: skillsText }] : [],
    languages: (sections.languages ?? [])
      .join(", ")
      .split(/[,;·•|]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6)
      .map((l) => {
        const [n, ...rest] = l.split(/\s+[-–—(:]\s*/);
        return { id: newId("lang"), name: n.trim(), level: rest.join(" ").replace(/\)$/, "").trim() };
      }),
  };
}

const looksLikeContact = (s: string) => /@|https?:|www\.|\|/.test(s) || /\+?\d[\d\s().-]{7,}\d/.test(s);

/**
 * Fixes common slips of small local models after an AI import:
 * contact details in the wrong field, missing contact info, and one skill per group.
 */
export function tidyImported(cv: CV, text: string): CV {
  const basic = basicParse(text);
  const p = { ...cv.personal };

  if (!p.name.trim() || looksLikeContact(p.name)) p.name = basic.personal.name;
  if (looksLikeContact(p.headline)) p.headline = looksLikeContact(basic.personal.headline) ? "" : basic.personal.headline;
  if (!p.headline.trim()) p.headline = basic.personal.headline;
  if (!/@/.test(p.email)) p.email = basic.personal.email;
  if (!/\d{6,}/.test(p.phone.replace(/\D/g, ""))) p.phone = basic.personal.phone;
  if (!/linkedin\.com/i.test(p.linkedin)) p.linkedin = basic.personal.linkedin;
  if (!/github\.com/i.test(p.github)) p.github = basic.personal.github;
  if (!p.website.trim() || /linkedin|github|@/.test(p.website)) p.website = basic.personal.website;
  if (looksLikeContact(p.location)) p.location = "";

  // Many groups with a single skill each: merge them into one "Skills" group.
  let skills = cv.skills.filter((s) => s.items.trim() || s.category.trim());
  const singles = skills.filter((s) => !/[,;]/.test(s.items));
  if (skills.length >= 4 && singles.length / skills.length >= 0.6) {
    const items = skills
      .flatMap((s) => (s.items.trim() ? s.items.split(/[,;]/) : [s.category]))
      .map((s) => s.trim())
      .filter(Boolean);
    skills = [{ id: newId("skill"), category: "Skills", items: [...new Set(items)].join(", ") }];
  }

  // Languages sometimes end up in the skills list.
  const langNames = cv.languages.map((l) => l.name.trim().toLowerCase()).filter(Boolean);
  const levels = new Set([
    ...cv.languages.map((l) => l.level.trim().toLowerCase()).filter(Boolean),
    "native", "fluent", "basic", "beginner", "intermediate", "advanced", "proficient", "conversational", "mother tongue",
    // common language names, removed only when they appear as a whole skill item
    "english", "urdu", "pashto", "punjabi", "sindhi", "balochi", "arabic", "hindi", "bengali", "persian", "farsi",
    "turkish", "french", "german", "spanish", "italian", "portuguese", "russian", "chinese", "mandarin", "japanese", "korean", "dutch",
  ]);
  if (langNames.length || skills.length) {
    skills = skills
      .map((s) => ({
        ...s,
        items: s.items
          .split(/,\s*/)
          .filter((item) => !langNames.some((l) => item.toLowerCase().startsWith(l)) && !levels.has(item.trim().toLowerCase()))
          .join(", "),
      }))
      .filter((s) => s.items.trim());
  }

  // "Tools used" copied from the skills list into every job is not real per-job information.
  const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const skillTexts = new Set([...cv.skills.map((s) => norm(s.items)), ...skills.map((s) => norm(s.items))]);
  const stacks = cv.experience.map((e) => norm(e.stack)).filter(Boolean);
  const sameEverywhere = stacks.length >= 2 && stacks.every((v) => v === stacks[0]);
  const experience = cv.experience.map((e) =>
    sameEverywhere || skillTexts.has(norm(e.stack)) || [...skillTexts].some((t) => t && norm(e.stack).startsWith(t.slice(0, 40)) && t.length > 40)
      ? { ...e, stack: "" }
      : e,
  );

  return {
    ...cv,
    personal: p,
    summary: cv.summary.trim() || basic.summary,
    skills: skills.length ? skills : basic.skills,
    experience: experience.filter((e) => e.role.trim() || e.company.trim() || e.bullets.some((b) => b.trim())),
    education: cv.education.filter((e) => e.degree.trim() || e.school.trim()),
    projects: cv.projects.filter((pr) => pr.name.trim() || pr.bullets.some((b) => b.trim())),
    certificates: cv.certificates.filter((c) => c.name.trim()),
    languages: cv.languages.filter((l) => l.name.trim()),
  };
}
