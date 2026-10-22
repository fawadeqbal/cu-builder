import type { CV } from "../resume/types";

export type LowConfidence = { path: string; label: string; reason: string };

const YEAR = /\b(19|20)\d{2}\b|present|current|now/i;

/**
 * Fields a recruiter should check after a bulk import: missing contact details, jobs without
 * dates or titles, empty sections. Paths match the CV shape so the editor can jump there.
 */
export function lowConfidenceFields(cv: CV): LowConfidence[] {
  const out: LowConfidence[] = [];
  const p = cv.personal;
  if (!p.name.trim()) out.push({ path: "personal.name", label: "Name", reason: "Not found" });
  else if (p.name.trim().split(/\s+/).length > 5 || /\d|@/.test(p.name)) out.push({ path: "personal.name", label: "Name", reason: "Looks unusual" });
  if (!p.email.trim()) out.push({ path: "personal.email", label: "Email", reason: "Not found" });
  if (!p.phone.trim()) out.push({ path: "personal.phone", label: "Phone", reason: "Not found" });
  if (!p.headline.trim()) out.push({ path: "personal.headline", label: "Headline", reason: "Not found" });
  if (!cv.experience.length) out.push({ path: "experience", label: "Experience", reason: "No jobs found" });
  cv.experience.forEach((e, i) => {
    const name = e.company || e.role || `Job ${i + 1}`;
    if (!e.role.trim()) out.push({ path: `experience.${i}.role`, label: `${name}: job title`, reason: "Missing" });
    if (!e.company.trim()) out.push({ path: `experience.${i}.company`, label: `${name}: company`, reason: "Missing" });
    if (!e.date.trim()) out.push({ path: `experience.${i}.date`, label: `${name}: dates`, reason: "Missing" });
    else if (!YEAR.test(e.date)) out.push({ path: `experience.${i}.date`, label: `${name}: dates`, reason: "Couldn't read the dates" });
    if (!e.bullets.some((b) => b.trim())) out.push({ path: `experience.${i}.bullets`, label: `${name}: duties`, reason: "No details" });
  });
  if (!cv.education.length) out.push({ path: "education", label: "Education", reason: "None found" });
  if (!cv.skills.length) out.push({ path: "skills", label: "Skills", reason: "None found" });
  return out;
}

/** The CV as a client sees it when the agency hides contact details. */
export function withoutContacts(cv: CV): CV {
  return { ...cv, personal: { ...cv.personal, email: "", phone: "", location: cv.personal.location.split(",").pop()?.trim() ?? "", website: "", github: "", linkedin: "", extra: "" } };
}
