import type { ParsedCV } from "./import";
import { newId, normalizeCV } from "./model";
import type { Certificate, CV, Education, Experience, Language, Project } from "./types";

/**
 * LinkedIn, two ways in:
 * - the data export ZIP (Settings → Data privacy → Get a copy of your data): its CSV files map
 *   straight onto CV fields, no guessing and no AI;
 * - the profile's "Save to PDF": a fixed two-column layout (Contact / Top Skills / Languages /
 *   Certifications on the side; name, Summary, Experience, Education in the main column) that the
 *   generic reader handles poorly, so it has its own rule-based reader.
 */

// ---------------------------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------------------------

const clean = (s: string) => s.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_WORD = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";
const MONTH_YEAR = new RegExp(`^(${MONTH_WORD})\\s+(\\d{4})$`, "i");
const NUMERIC_MONTH = /^(\d{1,2})[/.-](\d{4})$/;
const ISO_MONTH = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/;

const shortMonth = (m: string) => {
  const key = m.slice(0, 3).toLowerCase();
  return key[0]!.toUpperCase() + key.slice(1);
};

/** "January 2020", "Jan 2020", "01/2020", "2020-01" → "Jan 2020"; "2020" stays; anything else is kept as written. */
export function linkedInDate(raw: string): string {
  const v = clean(raw);
  const m = v.match(MONTH_YEAR);
  if (m) return `${shortMonth(m[1]!)} ${m[2]}`;
  const n = v.match(NUMERIC_MONTH);
  const iso = v.match(ISO_MONTH);
  const [month, year] = n ? [Number(n[1]), n[2]] : iso ? [Number(iso[2]), iso[1]] : [0, ""];
  if (month >= 1 && month <= 12) return `${shortMonth(MONTHS[month - 1]!)} ${year}`;
  return v;
}

/** Sort key for "Jan 2020" / "2020" (0 when unknown). */
function dateKey(date: string): number {
  const v = linkedInDate(date);
  const year = Number(v.match(/\b(19|20)\d{2}\b/)?.[0] ?? 0);
  const month = MONTHS.indexOf(v.slice(0, 3).toLowerCase()) + 1;
  return year * 100 + month;
}

/** "Jan 2020" + "" → "Jan 2020 – Present" (for current roles), or just the start. */
function dateRange(start: string, end: string, openEnded: boolean): string {
  const a = linkedInDate(start);
  const b = /^(present|current|now)$/i.test(clean(end)) ? "Present" : linkedInDate(end);
  if (a && b) return a === b ? a : `${a} – ${b}`;
  if (a) return openEnded ? `${a} – Present` : a;
  return b;
}

const BULLET_MARK = /^\s*(?:[•●◦▪‣∙·*–—-]|\d+[.)])\s+/;

/** A description as CV lines: one per line or bullet, with long single paragraphs split into sentences. */
export function descriptionBullets(text: string): string[] {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .flatMap((l) => l.split(/\s+[•●▪]\s+/))
    .map((l) => clean(l.replace(BULLET_MARK, "")))
    .filter(Boolean);
  if (lines.length === 1 && lines[0]!.length > 120) {
    const sentences = lines[0]!.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/).map(clean).filter(Boolean);
    if (sentences.length > 1) return sentences;
  }
  return lines;
}

const humanLevel = (level: string) => {
  const v = clean(level.replace(/_/g, " ").toLowerCase()).replace(/\s+proficiency$/, "");
  return v ? v[0]!.toUpperCase() + v.slice(1) : "";
};

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const URL_IN_TEXT = /\bhttps?:\/\/[^\s,\]]+|\bwww\.[^\s,\]]+/gi;

// ---------------------------------------------------------------------------------------------
// CSV and the data export
// ---------------------------------------------------------------------------------------------

/** RFC 4180 CSV: quoted fields with commas, doubled quotes and line breaks; CRLF or LF; BOM ignored. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field === "") quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

type Row = Record<string, string>;

/** CSV rows as records keyed by the header row. Skips LinkedIn's "Notes:" preamble and blank rows. */
export function csvRecords(text: string): Row[] {
  const blank = (r: string[]) => !r.some((c) => c.trim());
  let all = parseCsv(text);
  const first = all.findIndex((r) => !blank(r));
  // "Notes:" then a quoted note, then a blank row, then the real header.
  if (first >= 0 && /^notes:/i.test(all[first]![0]?.trim() ?? "")) {
    const gap = all.findIndex((r, i) => i > first && blank(r));
    all = gap > 0 ? all.slice(gap) : all.slice(first + 1);
  }
  const [header, ...body] = all.filter((r) => !blank(r));
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

const col = (row: Row | undefined, ...names: string[]) => {
  for (const n of names) {
    const v = row?.[n.toLowerCase()];
    if (v) return v;
  }
  return "";
};

/** File name → its key in the export ("Basic_Export/Email Addresses.csv" → "emailaddresses"). */
const fileKey = (path: string) =>
  (path.split(/[\\/]/).pop() ?? "")
    .toLowerCase()
    .replace(/\.csv$/, "")
    .replace(/[^a-z]/g, "");

/** True when a ZIP's file list is a LinkedIn data export (it always carries Profile.csv). */
export const isLinkedInExport = (paths: string[]): boolean => paths.some((p) => fileKey(p) === "profile" && /\.csv$/i.test(p));

/** The CSV files the CV is built from; the importer only needs to unzip these. */
export const LINKEDIN_EXPORT_FILES = ["profile", "positions", "education", "skills", "languages", "certifications", "projects", "emailaddresses", "phonenumbers"] as const;
export const isLinkedInExportFile = (path: string): boolean => (LINKEDIN_EXPORT_FILES as readonly string[]).includes(fileKey(path)) && /\.csv$/i.test(path);

/**
 * A LinkedIn data export (file path → CSV text) as a CV. Returns null without Profile.csv.
 * Everything comes from the person's own fields; nothing is rewritten.
 */
export function linkedInExportToCv(files: Record<string, string>): ParsedCV | null {
  const byKey = new Map<string, Row[]>();
  for (const [path, text] of Object.entries(files)) {
    if (/\.csv$/i.test(path)) byKey.set(fileKey(path), csvRecords(text));
  }
  const profileRows = byKey.get("profile");
  if (!profileRows) return null;
  const rows = (k: string) => byKey.get(k) ?? [];
  const profile = profileRows[0];
  const cv: CV = normalizeCV(null);
  const warnings: string[] = [];

  cv.personal.name = clean([col(profile, "First Name"), col(profile, "Last Name")].join(" "));
  cv.personal.headline = clean(col(profile, "Headline"));
  cv.personal.location = clean(col(profile, "Geo Location", "Location", "Address"));
  cv.summary = col(profile, "Summary").replace(/\r\n?/g, "\n").trim();

  const emails = rows("emailaddresses");
  const primary = emails.find((e) => /^yes$/i.test(col(e, "Primary"))) ?? emails[0];
  cv.personal.email = col(primary, "Email Address", "Email");
  cv.personal.phone = clean(col(rows("phonenumbers")[0], "Number", "Phone Number"));

  const websites = [...col(profile, "Websites").matchAll(URL_IN_TEXT)].map((m) => m[0].replace(/[\]).,]+$/, ""));
  // Only the person's own profile: other files (Connections.csv) hold other people's links.
  const profileText = Object.entries(files).find(([path]) => fileKey(path) === "profile")?.[1] ?? "";
  cv.personal.linkedin = profileText.match(/\b(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[\w%-]+\/?/i)?.[0] ?? "";
  cv.personal.github = websites.find((w) => /github\.com/i.test(w)) ?? "";
  cv.personal.website = websites.find((w) => !/github\.com|linkedin\.com/i.test(w)) ?? "";

  const positions = rows("positions")
    .map((p, i) => ({ p, i, key: dateKey(col(p, "Started On")) }))
    // LinkedIn already lists the newest first; the sort only fixes exports that don't.
    .sort((a, b) => b.key - a.key || a.i - b.i);
  cv.experience = positions
    .map(({ p }): Experience => ({
      id: newId("exp"),
      role: clean(col(p, "Title")),
      company: clean(col(p, "Company Name", "Company")),
      location: clean(col(p, "Location")),
      date: dateRange(col(p, "Started On"), col(p, "Finished On"), true),
      bullets: descriptionBullets(col(p, "Description")),
      stack: "",
    }))
    .filter((e) => e.role || e.company);

  cv.education = rows("education")
    .map((e): Education => ({
      id: newId("edu"),
      degree: clean([col(e, "Degree Name"), col(e, "Field Of Study", "Field of Study")].filter(Boolean).join(", ")),
      school: clean(col(e, "School Name", "School")),
      date: dateRange(col(e, "Start Date", "Started On"), col(e, "End Date", "Finished On"), false),
      details: [col(e, "Notes"), col(e, "Activities")].map(clean).filter(Boolean).join(" · "),
    }))
    .filter((e) => e.degree || e.school);

  const skills = [...new Set(rows("skills").map((s) => clean(col(s, "Name", "Skill"))).filter(Boolean))];
  if (skills.length) cv.skills = [{ id: newId("skill"), category: "Skills", items: skills.join(", ") }];

  cv.languages = rows("languages")
    .map((l): Language => ({ id: newId("lang"), name: clean(col(l, "Name", "Language")), level: humanLevel(col(l, "Proficiency")) }))
    .filter((l) => l.name);

  cv.certificates = rows("certifications")
    .map((c): Certificate => ({
      id: newId("cert"),
      name: clean(col(c, "Name")),
      issuer: clean(col(c, "Authority", "Issuer")),
      year: col(c, "Started On", "Issued On").match(/\b(19|20)\d{2}\b/)?.[0] ?? "",
      url: col(c, "Url", "URL"),
    }))
    .filter((c) => c.name);

  cv.projects = rows("projects")
    .map((p): Project => ({
      id: newId("proj"),
      name: clean(col(p, "Title", "Name")),
      date: dateRange(col(p, "Started On"), col(p, "Finished On"), false),
      links: [col(p, "Url", "URL")].filter(Boolean),
      bullets: descriptionBullets(col(p, "Description")),
      stack: "",
    }))
    .filter((p) => p.name);

  if (!cv.personal.name) warnings.push("We couldn't find your name. Add it in Details.");
  if (!cv.personal.email) warnings.push("Your export had no email address. Add one in Details.");
  if (!byKey.has("positions")) warnings.push("Your export had no Positions.csv. Ask LinkedIn for the full archive, or add your jobs in Experience.");
  if (cv.experience.some((e) => !e.bullets.length)) warnings.push("Some jobs have no description on LinkedIn. Add what you achieved in Experience.");
  return { cv, warnings };
}

// ---------------------------------------------------------------------------------------------
// The profile's "Save to PDF"
// ---------------------------------------------------------------------------------------------

const PAGE_FOOTER = /\s*\bPage \d+ of \d+\b\s*/g;
const MAIN = { summary: /^summary$/i, experience: /^experience$/i, education: /^education$/i } as const;
const SIDE = {
  contact: /^contact$/i,
  topSkills: /^top skills$/i,
  languages: /^languages$/i,
  certifications: /^certifications$/i,
  honors: /^honors[- ]awards$/i,
  publications: /^publications$/i,
  patents: /^patents$/i,
} as const;
type Heading = keyof typeof MAIN | keyof typeof SIDE;
const isMain = (h: Heading) => h in MAIN;

const headingOf = (line: string): Heading | null => {
  for (const [k, re] of Object.entries({ ...MAIN, ...SIDE })) if (re.test(line)) return k as Heading;
  return null;
};

const PDF_POINT = `(?:${MONTH_WORD}\\s+\\d{4}|\\d{4})`;
/** "July 2023 - Present (1 year 4 months)" */
const PDF_RANGE = new RegExp(`^(${PDF_POINT})\\s*[-–—]\\s*(${PDF_POINT}|present)(?:\\s*\\(([^)]*)\\))?$`, "i");
/** A company's total time when it lists several roles: "3 years 5 months". */
const DURATION = /^(?:\d+\s+years?(?:\s+\d+\s+months?)?|\d+\s+months?|less than a year)$/i;
const CONTACT_LABEL = /\((LinkedIn|Personal|Company|Portfolio|Blog|Other|RSS|Mobile|Home|Work)\)$/i;

const ROLE_WORDS =
  /\b(engineer|developer|manager|designer|analyst|consultant|lead|head|director|officer|specialist|intern|student|architect|scientist|founder|co-founder|ceo|cto|cfo|coo|president|associate|assistant|executive|administrator|coordinator|advisor|teacher|lecturer|professor|researcher|writer|editor|accountant|recruiter|marketer|owner|partner|certified|certificate|certification|professional|practitioner|foundations?|fundamentals|award|scholarship|university|college|school|institute|ltd|inc|llc|pvt|limited|group|solutions|technologies|services)\b/i;
const NAME_PARTICLE = /^(bin|bint|ibn|van|von|der|de|da|del|di|du|la|le|al|el|ul|ur|e)$/i;

/** "Ayesha Khan", "Muhammad Ali ul Haq": 2–5 words, capitalised, no job or organisation words. */
function looksLikeName(line: string): boolean {
  if (line.length > 40 || /[\d@|,:/()]/.test(line) || ROLE_WORDS.test(line)) return false;
  const words = line.split(" ");
  if (words.length < 2 || words.length > 5) return false;
  return words.every((w) => NAME_PARTICLE.test(w) || /^[\p{Lu}][\p{L}'’.-]*$/u.test(w));
}

/** "Lahore, Punjab, Pakistan", "Greater London Area", "Remote". */
function looksLikeLocation(line: string): boolean {
  if (line.length > 60 || /[\d@|:()]/.test(line) || /[.!?;]$/.test(line) || ROLE_WORDS.test(line) || /\s(at|and|for|with|of)\s/i.test(` ${line} `)) return false;
  const parts = line.split(/,\s*/);
  return parts.length <= 4 && parts.every((p) => p.split(" ").length <= 4 && p.split(" ").every((w) => /^[\p{Lu}][\p{L}'’.-]*$/u.test(w) || NAME_PARTICLE.test(w)));
}

const pdfDate = (m: RegExpMatchArray) => dateRange(m[1]!, m[2]!, true);

/** Joins lines the PDF wrapped back into paragraphs; a marked line or a finished sentence starts a new one. */
function unwrap(lines: string[]): string[] {
  const out: string[] = [];
  for (const raw of lines) {
    const marked = BULLET_MARK.test(raw);
    const line = clean(raw.replace(BULLET_MARK, ""));
    if (!line) continue;
    const last = out.at(-1);
    if (last !== undefined && !marked && !/[.!?:]$/.test(last)) out[out.length - 1] = `${last} ${line}`;
    else out.push(line);
  }
  return out;
}

/** Heuristic score: how sure we are that this text came from a LinkedIn profile PDF. */
export function isLinkedInPdfText(text: string): boolean {
  const lines = text.replace(/\r/g, "").split("\n").map(clean);
  const has = (re: RegExp) => lines.some((l) => re.test(l));
  const signals = [
    /\bPage \d+ of \d+\b/.test(text),
    has(SIDE.topSkills),
    has(SIDE.contact),
    /\(LinkedIn\)/.test(text) || /linkedin\.com\/in\//i.test(text),
    lines.some((l) => PDF_RANGE.test(l) && /\(\s*(\d+ (years?|months?)|less than a year)/i.test(l)),
  ].filter(Boolean).length;
  return signals >= 3 && has(MAIN.experience);
}

type Section = { key: Heading; lines: string[] };

function contactDetails(lines: string[], cv: CV): void {
  let buffer: string[] = [];
  for (const line of lines) {
    const email = line.match(EMAIL)?.[0];
    if (email && !buffer.length) {
      cv.personal.email ||= email;
      continue;
    }
    buffer.push(line);
    const label = line.match(CONTACT_LABEL)?.[1]?.toLowerCase();
    if (!label) continue;
    const joined = buffer.join(/^(mobile|home|work)$/.test(label) ? " " : "").replace(CONTACT_LABEL, "").trim();
    buffer = [];
    if (/^(mobile|home|work)$/.test(label)) cv.personal.phone ||= clean(joined);
    else if (label === "linkedin") cv.personal.linkedin ||= joined.replace(/\s/g, "");
    else if (/github\.com/i.test(joined)) cv.personal.github ||= joined.replace(/\s/g, "");
    else cv.personal.website ||= joined.replace(/\s/g, "");
  }
}

/** How many leading lines of a side section are its own items (the rest is the name block). */
function sideItems(key: Heading, lines: string[]): number {
  const leading = (test: (l: string) => boolean) => {
    let n = 0;
    while (n < lines.length && test(lines[n]!)) n++;
    return n;
  };
  if (key === "contact") return leading((l) => EMAIL.test(l) || CONTACT_LABEL.test(l) || /^[+\d][\d\s().-]{6,}$/.test(l) || /^(www\.|https?:)|\.[a-z]{2,}\//i.test(l));
  if (key === "languages") return leading((l) => /\([^)]*\)$/.test(l));
  if (key === "topSkills") return Math.min(3, lines.length);
  return 0;
}

/** Splits "name, headline, location" off the end of the lines that come before the main column. */
function nameBlock(lines: string[], minStart: number): { start: number; name: string; headline: string; location: string } {
  if (!lines.length) return { start: 0, name: "", headline: "", location: "" };
  const hasLocation = lines.length >= 3 && looksLikeLocation(lines.at(-1)!);
  const end = hasLocation ? lines.length - 1 : lines.length;
  let at = -1;
  for (const lower of [Math.min(minStart, Math.max(0, end - 2)), 0]) {
    for (let i = end - 2; i >= lower; i--) {
      if (looksLikeName(lines[i]!)) {
        at = i;
        break;
      }
    }
    if (at >= 0) break;
  }
  if (at < 0) at = Math.max(0, Math.min(minStart, end - 2));
  return {
    start: at,
    name: lines[at] ?? "",
    headline: clean(lines.slice(at + 1, end).join(" ")),
    location: hasLocation ? lines.at(-1)! : "",
  };
}

function pdfExperience(lines: string[]): Experience[] {
  const dates = lines.flatMap((l, i) => (PDF_RANGE.test(l) ? [i] : []));
  type Head = { d: number; start: number; role: string; company: string | null };
  const heads: Head[] = dates.map((d, k) => {
    const prev = k > 0 ? dates[k - 1]! : -1;
    const role = d - 1 > prev ? lines[d - 1]! : "";
    const c = d - 2;
    if (c > prev && DURATION.test(lines[c]!) && c - 1 > prev) return { d, start: c - 1, role, company: lines[c - 1]! };
    if (c > prev) {
      const line = lines[c]!;
      const short = line.length <= 70 && line.split(" ").length <= 8 && !/[.!?;:,]$/.test(line) && !BULLET_MARK.test(line) && /^[\p{Lu}\d"“]/u.test(line);
      const isCompany = prev < 0 || (c === prev + 1 ? !looksLikeLocation(line) && short : short);
      if (isCompany) return { d, start: c, role, company: line };
    }
    return { d, start: d - 1, role, company: null };
  });
  let company = "";
  return heads.map((h, k) => {
    company = h.company ?? company;
    const body = lines.slice(h.d + 1, heads[k + 1]?.start ?? lines.length);
    const location = body[0] && looksLikeLocation(body[0]) ? body.shift()! : "";
    return {
      id: newId("exp"),
      role: h.role,
      company,
      location,
      date: pdfDate(lines[h.d]!.match(PDF_RANGE)!),
      bullets: unwrap(body),
      stack: "",
    };
  });
}

const DEGREE_WORDS = /\b(bachelor|master|ba|bs|bsc|bba|be|btech|beng|ma|ms|msc|mba|mphil|phd|doctor|diploma|certificate|associate|intermediate|matric(ulation)?|a[- ]levels?|o[- ]levels?|fsc|hssc|ssc|ics|degree|licen[cs]e|course)\b/i;
const SCHOOL_WORDS = /\b(university|college|institute|school|academy|polytechnic)\b/i;

function pdfEducation(lines: string[]): Education[] {
  const out: { school: string; detail: string }[] = [];
  for (const line of lines) {
    const cur = out.at(-1);
    const openParen = cur && (cur.detail.match(/\(/g)?.length ?? 0) > (cur.detail.match(/\)/g)?.length ?? 0);
    const isDetail = /·\s*\(|^\(\s*\d{4}|^·/.test(line) || (cur && !cur.detail && DEGREE_WORDS.test(line) && !SCHOOL_WORDS.test(line));
    if (cur && (openParen || isDetail)) cur.detail = clean(`${cur.detail} ${line}`);
    else out.push({ school: line, detail: "" });
  }
  return out.map(({ school, detail }) => {
    const [degreePart = "", ...rest] = detail.split(/\s*·\s*/);
    const when = rest.join(" ").match(/\(([^)]*)\)/)?.[1] ?? degreePart.match(/^\(([^)]*)\)$/)?.[1] ?? "";
    const [from = "", to = ""] = when.split(/\s*[-–—]\s*/);
    return {
      id: newId("edu"),
      degree: /^\(/.test(degreePart) ? "" : degreePart,
      school,
      date: when ? dateRange(from, to, false) : "",
      details: "",
    };
  });
}

/** Rule-based reading of the text of a LinkedIn profile saved as PDF. */
export function parseLinkedInPdfText(text: string): ParsedCV {
  const lines = text
    .replace(/\r/g, "")
    .replace(PAGE_FOOTER, "\n")
    .split("\n")
    .map(clean)
    .filter(Boolean);
  const cv: CV = normalizeCV(null);
  const warnings: string[] = [];

  const preamble: string[] = [];
  const sections: Section[] = [];
  for (const line of lines) {
    const key = headingOf(line);
    if (key && !sections.some((s) => s.key === key)) sections.push({ key, lines: [] });
    else (sections.at(-1)?.lines ?? preamble).push(line);
  }

  // The name, headline and location sit just before the main column's first heading, at the end
  // of whatever came before it (the side column's last section, or the text before any heading).
  const firstMain = sections.findIndex((s) => isMain(s.key));
  const before = firstMain > 0 ? sections[firstMain - 1]! : null;
  const pool = before ? before.lines : preamble;
  const block = nameBlock(pool, before ? sideItems(before.key, pool) : 0);
  cv.personal.name = block.name;
  cv.personal.headline = block.headline;
  cv.personal.location = block.location;
  pool.splice(block.start);

  const get = (k: Heading) => sections.find((s) => s.key === k)?.lines ?? [];
  contactDetails(get("contact"), cv);
  const skills = get("topSkills");
  if (skills.length) cv.skills = [{ id: newId("skill"), category: "Skills", items: skills.join(", ") }];
  cv.languages = get("languages").map((l) => {
    const m = l.match(/^(.*?)\s*\(([^)]*)\)$/);
    return { id: newId("lang"), name: m ? m[1]! : l, level: m ? humanLevel(m[2]!) : "" };
  });
  cv.certificates = get("certifications").map((name) => ({ id: newId("cert"), name, issuer: "", year: "", url: "" }));
  cv.summary = unwrap(get("summary")).join("\n");
  cv.experience = pdfExperience(get("experience"));
  cv.education = pdfEducation(get("education"));

  if (!cv.personal.name) warnings.push("We couldn't find your name. Add it in Details.");
  if (!cv.personal.email) warnings.push("Your LinkedIn PDF shows no email address. Add one in Details.");
  if (skills.length) warnings.push("LinkedIn's PDF lists only your top skills. Add the rest in Skills.");
  if (get("honors").length || get("publications").length || get("patents").length) warnings.push("Honours, publications and patents from LinkedIn weren't imported. Add them in the editor if you want them on your CV.");
  if (sections.some((s) => s.key === "experience") && !cv.experience.length) warnings.push("Your work experience needs a check.");
  return { cv, warnings };
}

// ---------------------------------------------------------------------------------------------
// Writing a LinkedIn profile from a CV
// ---------------------------------------------------------------------------------------------

/** LinkedIn's own character limits for the parts a CV fills. */
export const LINKEDIN_LIMITS = { headline: 220, about: 2600, experience: 2000, skills: 5, headlineOptions: 3 } as const;

/**
 * Shortens text to `max` characters without cutting a word: at the last full sentence that fits
 * when one ends in the second half, otherwise at the last space.
 */
export function fitToLimit(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const head = t.slice(0, max + 1);
  const sentence = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "), head.lastIndexOf(".\n"));
  if (sentence >= max * 0.5) return t.slice(0, sentence + 1).trim();
  const space = head.search(/\s\S*$/);
  return t.slice(0, space > 0 ? space : max).replace(/[\s,;:–—-]+$/, "").trim();
}
