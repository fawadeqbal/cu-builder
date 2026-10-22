import { emptyDetails, emptyPersonal } from "../resume/model";
import type { CV } from "../resume/types";
import type { OrgKind } from "../orgs/roles";

/*
 * Opt-in talent search. Job seekers choose to be found by recruitment agencies, which CV to
 * show and how much of it. Recruiters search what people chose to share and can only reach
 * them through the platform, so a candidate's email is never handed out.
 */

/** "full": the CV as written (contacts included if the CV has them). "summary": no contacts, no details. */
export const TALENT_SHARE = ["full", "summary"] as const;
export type TalentShare = (typeof TALENT_SHARE)[number];

export const TALENT_LIMITS = {
  /** Messages one organisation member may send in any 24 hours. */
  contactsPerMemberPerDay: 20,
  /** One organisation may write to the same person once in this many days. */
  repeatContactDays: 7,
  roles: 5,
  skillsShown: 6,
} as const;

const DAY = 24 * 3600 * 1000;

/** Only recruitment agencies search for talent. */
export const canSearchTalent = (kind: OrgKind): boolean => kind === "agency";

// ─── What a profile is searched by ──────────────────────────────────────────

export type TalentSnapshot = { titles: string[]; skills: string[] };

const uniq = (items: string[], max: number): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const item = raw.replace(/\s+/g, " ").trim();
    const key = item.toLowerCase();
    if (!item || item.length > 80 || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= max) break;
  }
  return out;
};

/** Job titles and skills from a CV: what recruiters search by, refreshed whenever the CV changes. */
export function talentSnapshot(cv: CV): TalentSnapshot {
  return {
    titles: uniq([cv.personal.headline, ...cv.experience.map((e) => e.role)], 10),
    skills: uniq(cv.skills.flatMap((g) => g.items.split(/[,;|•·\n]/)), 40),
  };
}

/** Cleans the roles someone is open to: trimmed, unique, at most five. */
export const normalizeRoles = (roles: string[]): string[] => uniq(roles, TALENT_LIMITS.roles);

export type TalentListing = { headline: string; location: string; roles: string[] } & TalentSnapshot;
export type TalentQuery = { q?: string; location?: string; role?: string };

const fold = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

/** "React, Node  lahore" → ["react", "node", "lahore"] (at most eight terms). */
export const searchTerms = (q: string | undefined): string[] =>
  [...new Set(fold(q ?? "").split(/[\s,;]+/).filter((t) => t.length > 0))].slice(0, 8);

/** One lower-case string a database can match search terms against (title and skills only). */
export const talentSearchText = (l: TalentListing): string => fold([l.headline, ...l.titles, ...l.skills, ...l.roles].join(" · "));

/** Whether a listing answers a query: every keyword in its titles or skills, and the place and role. */
export function talentMatches(l: TalentListing, query: TalentQuery): boolean {
  const text = talentSearchText(l);
  if (!searchTerms(query.q).every((t) => text.includes(t))) return false;
  const place = fold(query.location ?? "");
  if (place && !fold(l.location).includes(place)) return false;
  const role = fold(query.role ?? "");
  if (role && ![...l.roles, ...l.titles, l.headline].some((r) => fold(r).includes(role))) return false;
  return true;
}

/** Orders matches: exact skill and title hits first, then partial ones. */
export function talentScore(l: TalentListing, query: TalentQuery): number {
  const skills = new Set(l.skills.map(fold));
  const titles = [l.headline, ...l.titles, ...l.roles].map(fold);
  let score = 0;
  for (const t of searchTerms(query.q)) {
    if (skills.has(t)) score += 3;
    else if (titles.some((x) => x.split(/\W+/).includes(t))) score += 2;
    else score += 1;
  }
  return score;
}

/** The skills shown on a search result. */
export const topSkills = (skills: string[], query: TalentQuery = {}): string[] => {
  const terms = searchTerms(query.q);
  const hit = (s: string) => terms.some((t) => fold(s).includes(t));
  return [...skills.filter(hit), ...skills.filter((s) => !hit(s))].slice(0, TALENT_LIMITS.skillsShown);
};

// ─── Who is visible ─────────────────────────────────────────────────────────

export type TalentVisibility = {
  visible: boolean;
  /** The chosen CV is in the bin or gone. */
  resumeDeleted: boolean;
  /** The account is suspended or being deleted. */
  userBlocked: boolean;
};

/** Shown in search only while switched on, with a live CV, on an account in good standing. */
export const isDiscoverable = (p: TalentVisibility): boolean => p.visible && !p.resumeDeleted && !p.userBlocked;

// ─── What a recruiter sees ──────────────────────────────────────────────────

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /(?:\+|00)?\d[\d\s().-]{7,}\d/g;
const LINK = /\b(?:https?:\/\/|www\.)\S+/gi;

/** Removes email addresses, phone numbers (nine digits or more, so years stay) and links from free text. */
export const redactContacts = (text: string): string =>
  text
    .replace(EMAIL, "[hidden]")
    .replace(LINK, "[hidden]")
    .replace(PHONE, (m) => (m.replace(/\D/g, "").length >= 9 ? "[hidden]" : m));

/** "Ayesha Khan" → "Ayesha". */
export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? "";

/**
 * The CV a recruiter may read. A full share is the CV as written, minus ID card numbers.
 * A summary keeps the first name, headline, summary, job titles and dates, skills, education,
 * certificates and languages, with every contact detail, link and personal detail removed.
 */
export function sharedTalentCV(cv: CV, share: TalentShare, location = ""): CV {
  if (share === "full") return { ...cv, details: { ...cv.details, idNumber: "" } };
  return {
    personal: { ...emptyPersonal, name: firstName(cv.personal.name), headline: redactContacts(cv.personal.headline), location },
    summary: redactContacts(cv.summary),
    experience: cv.experience.map((e) => ({ ...e, bullets: [], stack: redactContacts(e.stack) })),
    projects: [],
    skills: cv.skills.map((g) => ({ ...g, items: redactContacts(g.items) })),
    education: cv.education.map((e) => ({ ...e, details: "" })),
    certificates: cv.certificates.map((c) => ({ ...c, url: "" })),
    languages: cv.languages,
    details: emptyDetails,
    photo: "",
    settings: { ...cv.settings, photo: { ...cv.settings.photo, show: false } },
  };
}

// ─── Contact limits ─────────────────────────────────────────────────────────

export type ContactDecision =
  | { ok: true; left: number }
  | { ok: false; reason: "daily_limit" | "recently_contacted"; retryAt: Date };

/**
 * Whether an organisation member may write to someone now. `sentByMember` are the times the
 * member sent messages (any candidate); `lastFromOrg` is when anyone in the organisation last
 * wrote to this person.
 */
export function contactDecision(input: { sentByMember: Date[]; lastFromOrg: Date | null; now?: Date }): ContactDecision {
  const now = input.now ?? new Date();
  const since = now.getTime() - DAY;
  const recent = input.sentByMember.filter((d) => d.getTime() > since).sort((a, b) => +a - +b);
  if (recent.length >= TALENT_LIMITS.contactsPerMemberPerDay) {
    return { ok: false, reason: "daily_limit", retryAt: new Date(recent[recent.length - TALENT_LIMITS.contactsPerMemberPerDay]!.getTime() + DAY) };
  }
  const gap = TALENT_LIMITS.repeatContactDays * DAY;
  if (input.lastFromOrg && now.getTime() - input.lastFromOrg.getTime() < gap) {
    return { ok: false, reason: "recently_contacted", retryAt: new Date(input.lastFromOrg.getTime() + gap) };
  }
  return { ok: true, left: TALENT_LIMITS.contactsPerMemberPerDay - recent.length - 1 };
}

/** Messages a member can still send in the next 24 hours. */
export const contactsLeft = (sentByMember: Date[], now: Date = new Date()): number =>
  Math.max(0, TALENT_LIMITS.contactsPerMemberPerDay - sentByMember.filter((d) => d.getTime() > now.getTime() - DAY).length);
