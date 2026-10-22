import { clean, cleanLine, fitToLimit, LINKEDIN_LIMITS, splitList, type CV } from "@cvb/domain";
import type { LinkedInProfile } from "./types";

/**
 * LinkedIn profile helpers shared by both assistants: a deterministic draft built only from the
 * CV (the offline assistant's answer, and the fill-in for anything a model leaves out), and the
 * final pass that keeps every part inside LinkedIn's limits and every skill on the CV.
 */

const lowerFirst = (s: string) => (s && !/^[A-Z]{2}/.test(s) ? s[0]!.toLowerCase() + s.slice(1) : s);
const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");
const sentence = (s: string) => {
  const t = s.trim().replace(/[.;,\s]+$/, "");
  return t ? `${t}.` : "";
};

/** The CV's skills in order (groups first, then tools listed on jobs), without duplicates. */
export function cvSkills(cv: CV): string[] {
  const seen = new Set<string>();
  return [...cv.skills.flatMap((s) => splitList(s.items)), ...cv.experience.flatMap((e) => splitList(e.stack)), ...cv.projects.flatMap((p) => splitList(p.stack))].filter((s) => {
    const k = s.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** A job's CV lines as a LinkedIn description: one "•" line each, then its tools. */
export function entryDescription(e: CV["experience"][number]): string {
  const lines = clean(e.bullets).map((b) => `• ${cleanLine(b)}`);
  if (e.stack.trim()) lines.push(`Tools: ${e.stack.trim()}`);
  return fitToLimit(lines.join("\n"), LINKEDIN_LIMITS.experience);
}

/** A first draft from the CV alone: no model, no new facts, placeholders where only the person knows. */
export function draftLinkedInProfile(cv: CV, targetTitle?: string): LinkedInProfile {
  const recent = cv.experience[0];
  const title = targetTitle?.trim() || cv.personal.headline.trim() || recent?.role || "Professional";
  const skills = cvSkills(cv);
  const top = skills.slice(0, 3);
  const at = recent?.company ? ` at ${recent.company}` : "";

  const headlineOptions = [
    [title + (recent && recent.role === title ? at : ""), top.join(", ")].filter(Boolean).join(" | "),
    [title, ...top].join(" · "),
    top.length ? `${title} working with ${top.slice(0, 2).join(" and ")}` : `${title}${at}`,
  ]
    .map((h) => fitToLimit(h, LINKEDIN_LIMITS.headline))
    .filter((h, i, all) => h && all.indexOf(h) === i);

  const wins = cv.experience
    .flatMap((e) => clean(e.bullets).slice(0, 1).map((b) => ({ b: cleanLine(b), company: e.company })))
    .slice(0, 2);
  const intro = [
    `I'm ${article(title)} ${title}${recent && recent.role !== title ? `, currently ${recent.role}${at}` : at}.`,
    cv.summary.trim() ? sentence(cv.summary.trim().replace(/\s+/g, " ")) : "",
  ];
  const work = wins.map(({ b, company }, i) => sentence(`${i === 0 ? "Recently" : "Before that"}${company ? `, at ${company},` : ""} I ${lowerFirst(b)}`));
  const close = [skills.length ? sentence(`I work with ${skills.slice(0, 6).join(", ")}`) : "", "I'm open to [the kind of role or conversation you're looking for]."];
  const about = fitToLimit([intro, work, close].map((p) => p.filter(Boolean).join(" ")).filter(Boolean).join("\n\n"), LINKEDIN_LIMITS.about);

  return {
    headline: headlineOptions[0] ?? fitToLimit(title, LINKEDIN_LIMITS.headline),
    headlineOptions: headlineOptions.slice(0, LINKEDIN_LIMITS.headlineOptions),
    about,
    experience: cv.experience.map((e) => ({ id: e.id, role: e.role, company: e.company, description: entryDescription(e) })),
    skills: skills.slice(0, LINKEDIN_LIMITS.skills),
  };
}

/**
 * Makes a model's profile safe to show: within LinkedIn's limits, one description per CV job (in
 * the CV's order, falling back to the CV's own lines), skills only from the CV, and three
 * different headline options. `guard` replaces numbers the CV doesn't contain.
 */
export function finishLinkedInProfile(draft: LinkedInProfile, cv: CV, guard: (s: string) => string, targetTitle?: string): LinkedInProfile {
  const fallback = draftLinkedInProfile(cv, targetTitle);
  const fit = (s: string, max: number) => fitToLimit(guard(s.trim()), max);
  const byId = new Map(draft.experience.map((e) => [e.id, e.description]));
  const own = cvSkills(cv);
  const onCv = new Map(own.map((s) => [s.toLowerCase(), s]));
  const skills = [...new Set([...draft.skills.map((s) => onCv.get(cleanLine(s).toLowerCase())).filter((s): s is string => Boolean(s)), ...own])].slice(0, LINKEDIN_LIMITS.skills);
  const headline = fit(cleanLine(draft.headline), LINKEDIN_LIMITS.headline) || fallback.headline;
  const options = [...draft.headlineOptions.map((h) => fit(cleanLine(h), LINKEDIN_LIMITS.headline)), ...fallback.headlineOptions]
    .filter((h, i, all) => h && h !== headline && all.indexOf(h) === i)
    .slice(0, LINKEDIN_LIMITS.headlineOptions);
  return {
    headline,
    headlineOptions: options,
    about: fit(draft.about, LINKEDIN_LIMITS.about) || fallback.about,
    experience: cv.experience.map((e, i) => ({
      id: e.id,
      role: e.role,
      company: e.company,
      description: fit(byId.get(e.id) ?? "", LINKEDIN_LIMITS.experience) || fallback.experience[i]!.description,
    })),
    skills,
  };
}
