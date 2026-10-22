import type { CV } from "../resume/types";

/**
 * Comment anchors: stable addresses of lines in a CV ("experience.<itemId>.bullets.2"), so a
 * reviewer's comment stays attached to the right line while the owner edits elsewhere.
 */
export type CvLine = { anchor: string; section: string; label: string; text: string };

export function cvLines(cv: CV): CvLine[] {
  const out: CvLine[] = [];
  const push = (anchor: string, section: string, label: string, text: string) => text.trim() && out.push({ anchor, section, label, text });
  push("personal.headline", "Heading", "Headline", cv.personal.headline);
  push("personal.tagline", "Heading", "Tagline", cv.personal.tagline);
  push("summary", "Summary", "Summary", cv.summary);
  for (const e of cv.experience) {
    const where = [e.role, e.company].filter(Boolean).join(", ") || "Experience";
    push(`experience.${e.id}.role`, "Experience", `${where}: title`, e.role);
    e.bullets.forEach((b, i) => push(`experience.${e.id}.bullets.${i}`, "Experience", `${where}: line ${i + 1}`, b));
  }
  for (const p of cv.projects) {
    p.bullets.forEach((b, i) => push(`projects.${p.id}.bullets.${i}`, "Projects", `${p.name || "Project"}: line ${i + 1}`, b));
  }
  for (const s of cv.skills) push(`skills.${s.id}.items`, "Skills", s.category || "Skills", s.items);
  for (const ed of cv.education) push(`education.${ed.id}.details`, "Education", ed.school || ed.degree || "Education", ed.details);
  return out;
}

/** The current text at an anchor, or null when the line no longer exists. */
export function textAt(cv: CV, anchor: string): string | null {
  return cvLines(cv).find((l) => l.anchor === anchor)?.text ?? null;
}

/** Replaces the text at an anchor (a reviewer's suggestion). Unknown anchors leave the CV as is. */
export function applyAtAnchor(cv: CV, anchor: string, text: string): CV {
  const next = structuredClone(cv);
  const [section, id, field, index] = anchor.split(".");
  if (section === "summary") next.summary = text;
  else if (section === "personal" && (id === "headline" || id === "tagline")) next.personal[id] = text;
  else if (section === "experience" || section === "projects") {
    const item = (next[section] as { id: string; bullets: string[]; role?: string }[]).find((x) => x.id === id);
    if (!item) return cv;
    if (field === "bullets" && index !== undefined && item.bullets[Number(index)] !== undefined) item.bullets[Number(index)] = text;
    else if (field === "role" && section === "experience") item.role = text;
    else return cv;
  } else if (section === "skills") {
    const s = next.skills.find((x) => x.id === id);
    if (!s) return cv;
    s.items = text;
  } else if (section === "education") {
    const e = next.education.find((x) => x.id === id);
    if (!e) return cv;
    e.details = text;
  } else return cv;
  return next;
}
