import { clean } from "./model";
import type { CV } from "./types";

/**
 * Job-description match: which of the job's keywords the CV already contains, which are
 * missing (required vs nice to have), seniority fit and a match percentage. Deterministic, so
 * it is instant and free; AI tailoring builds on top of it.
 */

/** Canonical skill → spellings that mean the same thing. Lowercase. */
const SKILLS: Record<string, string[]> = {
  javascript: ["js", "ecmascript", "es6"],
  typescript: ["ts"],
  react: ["react.js", "reactjs"],
  "next.js": ["nextjs", "next js"],
  "vue.js": ["vue", "vuejs"],
  angular: ["angularjs"],
  svelte: [],
  "node.js": ["node", "nodejs"],
  express: ["express.js", "expressjs"],
  nestjs: ["nest.js"],
  python: [],
  django: [],
  flask: [],
  fastapi: [],
  java: [],
  spring: ["spring boot", "springboot"],
  kotlin: [],
  swift: [],
  "objective-c": [],
  "c#": ["csharp", "c sharp"],
  ".net": ["dotnet", "asp.net"],
  "c++": ["cpp"],
  go: ["golang"],
  rust: [],
  php: [],
  laravel: [],
  ruby: [],
  rails: ["ruby on rails"],
  sql: [],
  postgresql: ["postgres", "psql"],
  mysql: [],
  mongodb: ["mongo"],
  redis: [],
  elasticsearch: ["elastic search"],
  graphql: [],
  "rest apis": ["rest", "restful", "rest api"],
  grpc: [],
  microservices: ["micro-services"],
  docker: [],
  kubernetes: ["k8s"],
  terraform: [],
  ansible: [],
  aws: ["amazon web services"],
  azure: ["microsoft azure"],
  gcp: ["google cloud", "google cloud platform"],
  "ci/cd": ["cicd", "continuous integration", "continuous delivery"],
  "github actions": [],
  jenkins: [],
  git: [],
  linux: [],
  html: ["html5"],
  css: ["css3"],
  "tailwind css": ["tailwind", "tailwindcss"],
  sass: ["scss"],
  redux: [],
  jest: [],
  cypress: [],
  playwright: [],
  "unit testing": ["unit tests"],
  tdd: ["test-driven development"],
  "react native": [],
  flutter: [],
  android: [],
  ios: [],
  figma: [],
  "ui design": ["ui"],
  "ux design": ["ux", "user experience"],
  "machine learning": ["ml"],
  "deep learning": [],
  pytorch: [],
  tensorflow: [],
  "data analysis": ["data analytics"],
  pandas: [],
  numpy: [],
  "power bi": ["powerbi"],
  tableau: [],
  excel: ["microsoft excel", "ms excel"],
  "llm": ["large language models"],
  nlp: ["natural language processing"],
  agile: [],
  scrum: [],
  kanban: [],
  jira: [],
  "project management": [],
  "product management": [],
  "stakeholder management": [],
  leadership: ["team leadership"],
  mentoring: ["mentorship", "coaching"],
  communication: ["communication skills"],
  "problem solving": ["problem-solving"],
  sales: [],
  marketing: [],
  seo: ["search engine optimization"],
  "content writing": ["copywriting"],
  "social media": [],
  accounting: [],
  finance: [],
  budgeting: [],
  recruitment: ["recruiting", "talent acquisition"],
  "customer service": ["customer support"],
  "salesforce": [],
  "hubspot": [],
  "sap": [],
  "security": ["cybersecurity", "cyber security", "information security"],
  "oauth": [],
  "accessibility": ["a11y", "wcag"],
  "performance optimization": ["performance tuning"],
  "system design": [],
  "distributed systems": [],
  "event-driven": ["event driven"],
  kafka: [],
  rabbitmq: [],
  "data structures": [],
  algorithms: [],
  "english": [],
  "urdu": [],
  "arabic": [],
};

const STOP = new Set(
  (
    "a about above after again against all also an and any are as at be because been before being below between both but by can " +
    "could did do does doing down during each etc few for from further had has have having he her here hers him his how i if in " +
    "into is it its itself just me more most my no nor not now of off on once only or other our ours out over own same she should so " +
    "some such than that the their them then there these they this those through to too under until up very was we were what when " +
    "where which while who whom why will with you your yours role team work working job position company candidate candidates " +
    "experience years year strong ability able skills skill knowledge understanding good great excellent including include using " +
    "use within across new well based must required requirements preferred plus bonus nice ideal ideally looking join us we're " +
    "responsibilities qualifications opportunity apply please day days per will may like help make ensure various"
  ).split(/\s+/),
);

const NICE = /\b(nice to have|nice-to-have|bonus|preferred|a plus|is a plus|desirable|advantage|advantageous|ideally|would be great|optional)\b/i;
const REQUIRED_HINT = /\b(required|must|requirements|you have|you will need|minimum|essential|mandatory|qualifications)\b/i;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Find a term as a whole word (handles "c++", ".net", "node.js"). */
function contains(text: string, term: string): boolean {
  return new RegExp(`(^|[^a-z0-9+#.])${escape(term)}(?=$|[^a-z0-9+#])`, "i").test(text);
}

function canonicalFound(text: string): Set<string> {
  const found = new Set<string>();
  for (const [skill, aliases] of Object.entries(SKILLS)) {
    if ([skill, ...aliases].some((t) => contains(text, t))) found.add(skill);
  }
  return found;
}

/** Everything the CV says, lowercased, as one searchable text. */
export function cvText(cv: CV): string {
  const p = cv.personal;
  return [
    p.headline,
    p.tagline,
    cv.summary,
    ...cv.experience.flatMap((e) => [e.role, e.company, ...clean(e.bullets), e.stack]),
    ...cv.projects.flatMap((pr) => [pr.name, ...clean(pr.bullets), pr.stack]),
    ...cv.skills.flatMap((s) => [s.category, s.items]),
    ...cv.education.flatMap((e) => [e.degree, e.school, e.details]),
    ...cv.certificates.flatMap((c) => [c.name, c.issuer]),
    ...cv.languages.map((l) => l.name),
  ]
    .join("\n")
    .toLowerCase();
}

export type Seniority = "intern" | "junior" | "mid" | "senior" | "lead" | "manager" | "director";
const SENIORITY_ORDER: Seniority[] = ["intern", "junior", "mid", "senior", "lead", "manager", "director"];

export function detectSeniority(text: string): Seniority | null {
  const t = text.toLowerCase();
  if (/\b(director|head of|vp|vice president|chief)\b/.test(t)) return "director";
  if (/\b(engineering manager|manager)\b/.test(t)) return "manager";
  if (/\b(lead|principal|staff|architect)\b/.test(t)) return "lead";
  if (/\b(senior|sr\.?)\b/.test(t)) return "senior";
  if (/\b(junior|jr\.?|entry[- ]level|graduate|trainee)\b/.test(t)) return "junior";
  if (/\b(intern|internship)\b/.test(t)) return "intern";
  if (/\b(mid[- ]level|intermediate)\b/.test(t)) return "mid";
  return null;
}

/** "3+ years", "at least 5 years", "2-4 years" → the minimum. */
export function requiredYears(text: string): number | null {
  const m = text.toLowerCase().match(/(\d{1,2})\s*(?:\+|-\s*\d{1,2}|to\s*\d{1,2})?\s*(?:\+)?\s*years?/);
  return m ? Number(m[1]) : null;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Parses "Mar 2021 – Present" or "2018 - 2022" into month indexes (year*12+month). */
export function parseRange(date: string, now: Date): [number, number] | null {
  const d = date.toLowerCase();
  const points = [...d.matchAll(/(?:\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?((?:19|20)\d{2})/g)].map((m) => {
    const month = m[1] ? MONTHS.indexOf(m[1].slice(0, 3)) : 0;
    return Number(m[2]) * 12 + Math.max(0, month);
  });
  if (!points.length) return null;
  const start = points[0]!;
  const end = /\b(present|current|now|today)\b/.test(d) ? now.getFullYear() * 12 + now.getMonth() : (points[1] ?? start + 11);
  return end >= start ? [start, end] : null;
}

/** Total years of experience across jobs, overlaps counted once. */
export function experienceYears(cv: CV, now: Date = new Date()): number {
  const ranges = cv.experience
    .map((e) => parseRange(e.date, now))
    .filter((r): r is [number, number] => r !== null)
    .sort((a, b) => a[0] - b[0]);
  let months = 0;
  let cur: [number, number] | null = null;
  for (const r of ranges) {
    if (!cur || r[0] > cur[1]) {
      if (cur) months += cur[1] - cur[0] + 1;
      cur = [r[0], r[1]];
    } else cur[1] = Math.max(cur[1], r[1]);
  }
  if (cur) months += cur[1] - cur[0] + 1;
  return Math.round((months / 12) * 10) / 10;
}

export type MatchKeyword = { keyword: string; required: boolean; found: boolean; section: "skills" | "summary" | "experience" };

export type JobMatch = {
  score: number;
  keywords: MatchKeyword[];
  found: string[];
  missing: string[];
  seniority: { job: Seniority | null; cv: Seniority | null; jobYears: number | null; cvYears: number; fit: "under" | "match" | "over" | "unknown" };
  titleMatch: boolean;
};

/** Frequent meaningful words in the job ad that aren't in the skill dictionary (domain terms). */
function frequentTerms(text: string, known: Set<string>): string[] {
  const counts = new Map<string, number>();
  for (const w of text.toLowerCase().match(/[a-z][a-z+#.-]{3,}/g) ?? []) {
    const word = w.replace(/[.-]+$/, "");
    if (STOP.has(word) || known.has(word) || word.length < 4) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);
}

export function matchJob(cv: CV, job: { title?: string; description: string }, now: Date = new Date()): JobMatch {
  const text = cvText(cv);
  const description = job.description;
  const lines = description.split(/\n+|(?<=[.;])\s+/);
  const required = new Set<string>();
  const nice = new Set<string>();
  let mode: "required" | "nice" = "required";
  for (const line of lines) {
    // A heading like "Nice to have:" switches mode for the lines under it.
    if (NICE.test(line) && line.trim().length < 40) mode = "nice";
    else if (REQUIRED_HINT.test(line) && line.trim().length < 40) mode = "required";
    const inLine = canonicalFound(line);
    const isNice = mode === "nice" || NICE.test(line);
    for (const s of inLine) (isNice ? nice : required).add(s);
  }
  for (const s of required) nice.delete(s);

  const cvSkills = canonicalFound(text);
  const extras = frequentTerms(description, new Set([...required, ...nice])).filter((w) => !required.has(w));
  const keywords: MatchKeyword[] = [
    ...[...required].map((k) => ({ keyword: k, required: true, found: cvSkills.has(k), section: "skills" as const })),
    ...[...nice].map((k) => ({ keyword: k, required: false, found: cvSkills.has(k), section: "skills" as const })),
    ...extras.map((k) => ({ keyword: k, required: false, found: contains(text, k), section: "summary" as const })),
  ];

  const title = (job.title ?? "").trim();
  const titleWords = title.toLowerCase().split(/\W+/).filter((w) => w.length > 2 && !STOP.has(w));
  const headline = `${cv.personal.headline} ${cv.experience[0]?.role ?? ""}`.toLowerCase();
  const titleMatch = titleWords.length > 0 && titleWords.filter((w) => headline.includes(w)).length >= Math.ceil(titleWords.length / 2);

  const weight = (k: MatchKeyword) => (k.required ? 3 : 1);
  const total = keywords.reduce((n, k) => n + weight(k), 0);
  const got = keywords.filter((k) => k.found).reduce((n, k) => n + weight(k), 0);
  let score = total ? (got / total) * 85 : 50;
  if (titleMatch) score += 15;
  else if (!title) score += 7;

  const jobSeniority = detectSeniority(`${title}\n${description.slice(0, 400)}`);
  const cvSeniority = detectSeniority(`${cv.personal.headline} ${cv.experience[0]?.role ?? ""}`);
  const jobYears = requiredYears(description);
  const cvYears = experienceYears(cv, now);
  let fit: JobMatch["seniority"]["fit"] = "unknown";
  if (jobYears !== null) fit = cvYears + 0.5 < jobYears ? "under" : cvYears > jobYears + 6 ? "over" : "match";
  else if (jobSeniority && cvSeniority) {
    const d = SENIORITY_ORDER.indexOf(cvSeniority) - SENIORITY_ORDER.indexOf(jobSeniority);
    fit = d < 0 ? "under" : d > 1 ? "over" : "match";
  }
  if (fit === "under") score -= 8;

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    keywords,
    found: keywords.filter((k) => k.found).map((k) => k.keyword),
    missing: keywords.filter((k) => !k.found).map((k) => k.keyword),
    seniority: { job: jobSeniority, cv: cvSeniority, jobYears, cvYears, fit },
    titleMatch,
  };
}

/** Adds a missing keyword to the CV in a sensible place (a "Keywords"/first skills group). */
export function addKeyword(cv: CV, keyword: string, newId: () => string): CV {
  const label = keyword.length <= 4 ? keyword.toUpperCase() : keyword.replace(/\b\w/g, (c) => c.toUpperCase());
  const target = cv.skills.find((s) => /skill|tool|tech|key/i.test(s.category)) ?? cv.skills[0];
  if (!target) return { ...cv, skills: [{ id: newId(), category: "Skills", items: label }] };
  return {
    ...cv,
    skills: cv.skills.map((s) => (s.id === target.id ? { ...s, items: s.items.trim() ? `${s.items.trim()}, ${label}` : label } : s)),
  };
}
