import { clean, linkLabel } from "./model";
import { DETAIL_LABELS, visibleDetails } from "./regional";
import type { CV } from "./types";

/**
 * The CV as plain text, for pasting into job portals that only take a text box.
 * Plain section headings in capitals, "- " bullets, no tabs, lines kept as written.
 */
export function cvToText(cv: CV): string {
  const out: string[] = [];
  const p = cv.personal;
  const line = (...parts: string[]) => parts.map((s) => s.trim()).filter(Boolean).join(" | ");
  const section = (title: string, body: string[]) => {
    const lines = body.filter((l) => l !== undefined);
    if (lines.some((l) => l.trim())) out.push("", title.toUpperCase(), ...lines);
  };

  if (p.name.trim()) out.push(p.name.trim());
  if (p.headline.trim()) out.push(p.headline.trim());
  const contact = line(p.email, p.phone, p.location);
  if (contact) out.push(contact);
  const links = line(...[p.website, p.linkedin, p.github].filter((s) => s.trim()).map(linkLabel), p.extra);
  if (links) out.push(links);
  const details = visibleDetails(cv).map((d) => `${DETAIL_LABELS[d.key]}: ${d.value}`);
  if (details.length) out.push(line(...details));

  section("Summary", cv.summary.trim() ? [cv.summary.trim()] : []);

  section(
    "Experience",
    cv.experience.flatMap((e, i) => [
      ...(i > 0 ? [""] : []),
      line([e.role, e.company].map((s) => s.trim()).filter(Boolean).join(", "), e.location, e.date),
      ...clean(e.bullets).map((b) => `- ${b}`),
      ...(e.stack.trim() ? [`Stack: ${e.stack.trim()}`] : []),
    ]),
  );

  section(
    "Projects",
    cv.projects.flatMap((pr, i) => [
      ...(i > 0 ? [""] : []),
      line(pr.name, pr.date),
      ...pr.links.filter((l) => l.trim()).map((l) => linkLabel(l)),
      ...clean(pr.bullets).map((b) => `- ${b}`),
      ...(pr.stack.trim() ? [`Stack: ${pr.stack.trim()}`] : []),
    ]),
  );

  section(
    "Skills",
    cv.skills
      .filter((s) => s.items.trim())
      .map((s) => (s.category.trim() ? `${s.category.trim()}: ${s.items.trim()}` : s.items.trim())),
  );

  section(
    "Education",
    cv.education.flatMap((e) => [line([e.degree, e.school].map((s) => s.trim()).filter(Boolean).join(", "), e.date), ...(e.details.trim() ? [e.details.trim()] : [])]),
  );

  section(
    "Certificates",
    cv.certificates.filter((c) => c.name.trim()).map((c) => line(c.name, c.issuer, c.year, c.url ? linkLabel(c.url) : "")),
  );

  section(
    "Languages",
    cv.languages.filter((l) => l.name.trim()).map((l) => (l.level.trim() ? `${l.name.trim()} (${l.level.trim()})` : l.name.trim())),
  );

  return `${out.join("\n").trim()}\n`;
}
