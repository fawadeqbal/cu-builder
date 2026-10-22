import { newId, normalizeCV } from "./model";
import type { CV, Education, Experience, Project } from "./types";

/**
 * Turns plain text from an uploaded CV (PDF or Word) into a CV document. Heuristic by nature:
 * it finds contact details, section headings and dated entries, and reports what it could not
 * find so the person can review before relying on it.
 */

export type ParsedCV = { cv: CV; warnings: string[] };

type SectionKey = "summary" | "experience" | "education" | "skills" | "projects" | "certificates" | "languages" | "other";

const HEADINGS: [SectionKey, RegExp][] = [
  ["summary", /^(professional\s+)?(summary|profile|about( me)?|objective|career objective|personal statement)$/],
  ["experience", /^((work|professional|employment|career)\s+)?(experience|history|employment)( history)?$/],
  ["education", /^(education|academic( background)?|qualifications|education (and|&) training)$/],
  ["skills", /^((technical|key|core)\s+)?(skills|competencies|expertise|technologies|skills (and|&) tools)$/],
  ["projects", /^((personal|selected|key|academic)\s+)?projects$/],
  ["certificates", /^(certifications?|certificates|licen[cs]es( (and|&) certifications)?|courses)$/],
  ["languages", /^languages?$/],
  ["other", /^(interests|hobbies|references|awards|publications|volunteering|achievements)$/],
];

const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const POINT = `(?:${MONTH}\\s*\\d{4}|\\d{1,2}[/.-]\\d{4}|\\d{4})`;
const DATE_RANGE = new RegExp(`(${POINT})\\s*(?:–|—|-|to|until)\\s*(${POINT}|present|current|now|ongoing)`, "i");
const SINGLE_DATE = new RegExp(`\\b(${POINT})\\b`, "i");
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE = /(\+?\d[\d\s().-]{7,}\d)/;
const TLD = "(?:com|dev|io|net|org|me|app|co|ai|tech|site|xyz|info|edu|gov|pk|uk|in|ae|sa|de|fr|ca|au|nl|eu|us|page|link|so|sh)";
const URL = new RegExp(
  `\\b((?:https?:\\/\\/[^\\s,;|]+)|(?:www\\.)?[a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.${TLD}(?:\\/[^\\s,;|]*)?)(?![a-z0-9])`,
  "gi",
);
const BULLET = /^\s*(?:[•●◦▪‣∙·*–—-]|\d+[.)])\s+/;

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const headingKey = (line: string): SectionKey | null => {
  const t = clean(line).replace(/[:|]+$/, "").toLowerCase();
  if (t.length > 40) return null;
  return HEADINGS.find(([, re]) => re.test(t))?.[0] ?? null;
};

const isCapsWord = (w: string) => /^[A-Z&/]{2,}$/.test(w);

/**
 * Real PDFs put headings inline ("ABOUT ME Full stack developer…") or across two lines
 * ("WORK" / "EXPERIENCE"). Normalise both into a heading line followed by content.
 */
function normaliseHeadings(lines: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = clean(lines[i]!);
    // "EDUCATION" then "AND TRAINING …": fold the caps continuation into the heading.
    const prev = out.at(-1);
    if (prev && headingKey(prev)) {
      const words = line.split(" ");
      const lead: string[] = [];
      for (const w of words) {
        if (!isCapsWord(w)) break;
        lead.push(w);
      }
      if (lead.length && headingKey(`${prev} ${lead.join(" ")}`) === headingKey(prev) && /^(AND|&)$/.test(lead[0]!)) {
        out[out.length - 1] = `${prev} ${lead.join(" ")}`;
        const rest = words.slice(lead.length).join(" ");
        if (rest) out.push(rest);
        continue;
      }
    }
    const next = lines[i + 1] ? clean(lines[i + 1]!) : "";
    const words = line.split(" ");
    if (words.every(isCapsWord) && words.length <= 2 && !headingKey(line) && next) {
      const nextWords = next.split(" ");
      const capsLead = nextWords.findIndex((w) => !isCapsWord(w));
      const lead = capsLead === -1 ? nextWords : nextWords.slice(0, capsLead);
      if (lead.length && headingKey(`${line} ${lead.join(" ")}`)) {
        out.push(`${line} ${lead.join(" ")}`);
        const rest = nextWords.slice(lead.length).join(" ");
        if (rest) out.push(rest);
        i++;
        continue;
      }
    }
    const lead: string[] = [];
    for (const w of words) {
      if (!isCapsWord(w)) break;
      lead.push(w);
    }
    let split = false;
    for (let n = lead.length; n >= 1 && n < words.length; n--) {
      if (headingKey(lead.slice(0, n).join(" "))) {
        out.push(lead.slice(0, n).join(" "), words.slice(n).join(" "));
        split = true;
        break;
      }
    }
    if (!split) out.push(line);
  }
  return out;
}

function splitSections(lines: string[]): { head: string[]; sections: Map<SectionKey, string[]> } {
  const sections = new Map<SectionKey, string[]>();
  const head: string[] = [];
  let current: SectionKey | null = null;
  for (const line of lines) {
    const key = headingKey(line);
    if (key) {
      current = key;
      if (!sections.has(key)) sections.set(key, []);
      continue;
    }
    if (current) sections.get(current)!.push(line);
    else head.push(line);
  }
  return { head, sections };
}

function extractDate(line: string): { date: string; rest: string } {
  const range = line.match(DATE_RANGE);
  const m = range ?? line.match(SINGLE_DATE);
  if (!m) return { date: "", rest: line };
  const date = clean(m[0]).replace(/\s*(?:–|—|-|to|until)\s*/i, " – ").replace(/\b(present|current|now|ongoing)\b/i, "Present");
  const rest = clean(line.replace(m[0], "").replace(/[()|,–—-]\s*$/, "").replace(/^\s*[()|,–—-]/, ""));
  return { date, rest };
}

/** "Role — Company", "Role at Company", "Role, Company", "Role | Company". */
function splitTitle(text: string): [string, string] {
  const parts = text.split(/\s+(?:—|–|-|\||@|at)\s+|,\s+/i).map(clean).filter(Boolean);
  if (parts.length >= 2) return [parts[0]!, parts.slice(1).join(", ")];
  return [clean(text), ""];
}

type Block = { header: string[]; bullets: string[]; stack: string };

const STACK = /^(stack|tools|tech(nologies)?|built with)\s*:\s*/i;

/**
 * Groups a section into entries: header lines followed by bullet lines. Without bullet marks,
 * sentence-like lines (long, or ending in a full stop) count as bullets, and a line that wraps
 * a previous bullet is joined to it.
 */
function blocks(lines: string[]): Block[] {
  const out: Block[] = [];
  let cur: Block | null = null;
  for (const raw of lines) {
    const marked = BULLET.test(raw);
    const line = clean(raw.replace(BULLET, ""));
    if (!line) continue;
    if (cur && STACK.test(line)) {
      cur.stack = line.replace(STACK, "");
      continue;
    }
    const prose = !DATE_RANGE.test(line) && (line.length > 70 || /[.!]$/.test(line));
    const commas = line.match(/,/g)?.length ?? 0;
    if (cur?.bullets.length && !cur.stack && !marked && !/[.!]$/.test(line) && (commas >= 3 || (!prose && commas >= 2))) {
      cur.stack = line;
      continue;
    }
    const last = cur?.bullets.at(-1);
    const continues =
      /^[a-z0-9(]/.test(line) || /\b(a|an|the|and|or|with|to|of|for|in|on|by|from)$/i.test(last ?? "") || line.length < 30;
    if (cur && !marked && last && !/[.!?]$/.test(last) && continues && !DATE_RANGE.test(line)) {
      cur.bullets[cur.bullets.length - 1] = `${last} ${line}`;
      continue;
    }
    const isBullet = marked || (Boolean(cur?.header.length) && prose);
    const startsNew = !isBullet && (!cur || cur.bullets.length > 0 || (DATE_RANGE.test(line) && cur.header.some((h) => DATE_RANGE.test(h))));
    if (startsNew) {
      cur = { header: [line], bullets: [], stack: "" };
      out.push(cur);
    } else if (!cur) {
      cur = { header: [], bullets: [line], stack: "" };
      out.push(cur);
    } else if (isBullet || cur.header.length >= 3) {
      cur.bullets.push(line);
    } else {
      cur.header.push(line);
    }
  }
  return out;
}

function parseExperience(lines: string[]): Experience[] {
  return blocks(lines)
    .map((b) => {
      let date = "";
      const header = b.header.map((h) => {
        const d = extractDate(h);
        if (d.date && !date) date = d.date;
        return d.date ? d.rest : h;
      }).filter(Boolean);
      const [role, inlineCompany] = splitTitle(header[0] ?? "");
      let company = inlineCompany || header[1] || "";
      let location = inlineCompany ? (header[1] ?? "") : (header[2] ?? "");
      // "Bright Labs · Lahore, Pakistan"
      const dot = company.split(/\s+·\s+/);
      if (dot.length > 1 && !location) [company, location] = [dot[0]!, dot.slice(1).join(", ")];
      return {
        id: newId("exp"),
        role,
        company,
        location,
        date,
        bullets: b.bullets,
        stack: b.stack,
      };
    })
    .filter((e) => e.role || e.company);
}

function parseEducation(lines: string[]): Education[] {
  return blocks(lines)
    .map((b) => {
      let date = "";
      const header = b.header
        .map((h) => {
          const d = extractDate(h);
          if (d.date && !date) date = d.date;
          return d.date ? d.rest : h;
        })
        .filter(Boolean);
      const [degree, school] = splitTitle(header[0] ?? "");
      return {
        id: newId("edu"),
        degree,
        school: school || header[1] || "",
        date,
        details: [...header.slice(school ? 1 : 2), ...b.bullets]
          .join(" · ")
          .split(/\s*·\s*/)
          .filter(Boolean)
          .join(" · "),
      };
    })
    .filter((e) => e.degree || e.school);
}

function parseProjects(lines: string[]): Project[] {
  return blocks(lines)
    .map((b) => {
      let date = "";
      const links: string[] = [];
      const header = b.header
        .map((h) => {
          for (const m of h.matchAll(URL)) if (!EMAIL.test(m[0])) links.push(m[0]);
          const d = extractDate(h.replace(URL, ""));
          if (d.date && !date) date = d.date;
          return clean((d.date ? d.rest : h).replace(URL, "").replace(/[|·—–-]\s*$/, ""));
        })
        .filter(Boolean);
      return { id: newId("proj"), name: header[0] ?? "", date, links, bullets: b.bullets, stack: b.stack };
    })
    .filter((p) => p.name);
}

function parseSkills(lines: string[]) {
  const groups: { id: string; category: string; items: string }[] = [];
  const loose: string[] = [];
  for (const raw of lines) {
    const line = clean(raw.replace(BULLET, ""));
    const m = line.match(/^([^:]{2,30}):\s*(.+)$/);
    if (m) groups.push({ id: newId("skill"), category: clean(m[1]!), items: clean(m[2]!) });
    else if (line) loose.push(line);
  }
  if (loose.length) groups.push({ id: newId("skill"), category: groups.length ? "Other" : "Skills", items: loose.join(", ") });
  return groups;
}

function parseLanguages(lines: string[]) {
  return lines
    .flatMap((l) => clean(l.replace(BULLET, "")).split(/\s*[,;·|]\s*/))
    .map((item) => {
      const m = item.match(/^([A-Za-zÀ-ÿ ]{2,30}?)\s*(?:[(:–—-]\s*([^)]*)\)?)?$/);
      return m ? { id: newId("lang"), name: clean(m[1]!), level: clean(m[2] ?? "") } : null;
    })
    .filter((x): x is { id: string; name: string; level: string } => Boolean(x && x.name));
}

function parseCertificates(lines: string[]) {
  const merged: string[] = [];
  for (const raw of lines) {
    const line = clean(raw.replace(BULLET, ""));
    if (!line) continue;
    // "Amazon Web Services · 2024" under a certificate name is its issuer line.
    if (merged.length && /·\s*(19|20)\d{2}$/.test(line) && !/[—–,]/.test(merged.at(-1)!)) {
      merged[merged.length - 1] = `${merged.at(-1)} — ${line.replace(/\s*·\s*/, ", ")}`;
    } else merged.push(line);
  }
  return merged
    .map((line) => {
      const year = line.match(/\b(19|20)\d{2}\b/)?.[0] ?? "";
      const url = line.match(URL)?.find((u) => !EMAIL.test(u)) ?? "";
      const base = clean(line.replace(year, "").replace(url, "").replace(/[(),]+\s*$/, ""));
      const [name, issuer] = splitTitle(base);
      return { id: newId("cert"), name, issuer, year, url };
    });
}

export function parseResumeText(text: string): ParsedCV {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/\u00a0/g, " ").trimEnd())
    .filter((l) => clean(l).length > 0);

  const { head, sections } = splitSections(normaliseHeadings(lines));
  const whole = lines.join("\n");
  const cv: CV = normalizeCV(null);
  const warnings: string[] = [];

  // Contact details can sit anywhere, usually at the top.
  cv.personal.email = whole.match(EMAIL)?.[0] ?? "";
  const phone = head.join(" ").match(PHONE)?.[1] ?? whole.match(PHONE)?.[1] ?? "";
  cv.personal.phone = /\d{4}\s*[–—-]\s*\d{4}/.test(phone) ? "" : clean(phone);
  for (const m of whole.matchAll(URL)) {
    const url = m[0].replace(/[.,)]+$/, "");
    if (EMAIL.test(url) || url.includes("@") || whole[(m.index ?? 0) - 1] === "@") continue;
    if (/linkedin\.com/i.test(url)) cv.personal.linkedin ||= url;
    else if (/github\.com/i.test(url) && !/github\.com\/[^/\s]+\/[^/\s]+/i.test(url)) cv.personal.github ||= url;
    else if (!cv.personal.website && head.some((h) => h.includes(m[0]))) cv.personal.website = url;
  }

  // Name and headline: the first plain lines of the header.
  const plain = head.map(clean).filter((l) => !EMAIL.test(l) && !PHONE.test(l) && !/https?:|www\.|\.com|\.dev/i.test(l));
  const name = plain.find((l) => /^[A-Za-zÀ-ÿ.'-]+(?: [A-Za-zÀ-ÿ.'-]+){1,3}$/.test(l) && l.length <= 40);
  if (name) cv.personal.name = name;
  const afterName = name ? plain.slice(plain.indexOf(name) + 1) : plain;
  if (afterName[0] && afterName[0].length <= 80) cv.personal.headline = afterName[0];
  if (afterName[1] && afterName[1].length <= 120 && /[·|,]/.test(afterName[1])) cv.personal.tagline = afterName[1];
  const location = head.map(clean).find((l) => /^[A-Za-z .'-]+,\s*[A-Za-z .'-]+$/.test(l) && l !== name);
  if (location) cv.personal.location = location;

  cv.summary = (sections.get("summary") ?? []).map(clean).join(" ");
  if (!cv.summary) {
    // Many layouts put the profile paragraph under the name without a heading.
    cv.summary = head
      .map(clean)
      .filter((l) => l.length > 60 && !EMAIL.test(l) && l !== cv.personal.tagline)
      .join(" ");
  }
  cv.experience = parseExperience(sections.get("experience") ?? []);
  cv.education = parseEducation(sections.get("education") ?? []);
  cv.skills = parseSkills(sections.get("skills") ?? []);
  cv.projects = parseProjects(sections.get("projects") ?? []);
  cv.certificates = parseCertificates(sections.get("certificates") ?? []);
  cv.languages = parseLanguages(sections.get("languages") ?? []);

  if (!cv.personal.name) warnings.push("We couldn't find your name. Add it in Details.");
  if (!cv.personal.email) warnings.push("We couldn't find an email address.");
  if (!sections.size) warnings.push("We couldn't find section headings, so only contact details were imported.");
  if (sections.has("experience") && !cv.experience.length) warnings.push("Your work experience needs a check.");
  if (cv.experience.some((e) => !e.date)) warnings.push("Some jobs have no dates. Check Experience.");
  if (sections.has("education") && !cv.education.length) warnings.push("Your education needs a check.");

  return { cv, warnings };
}
