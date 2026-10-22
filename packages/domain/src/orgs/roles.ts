import { atLeast, type Plan } from "../billing/plans";

export const ORG_KINDS = ["university", "agency", "partner"] as const;
export type OrgKind = (typeof ORG_KINDS)[number];

export const ORG_ROLES = ["owner", "admin", "reviewer", "recruiter", "member"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const ORG_ACTIONS = [
  "org.view",
  "org.edit",
  "members.view",
  "members.manage",
  "invites.send",
  "cohort.view",
  "cohort.export",
  "cv.review",
  "candidates.view",
  "candidates.manage",
] as const;
export type OrgAction = (typeof ORG_ACTIONS)[number];

/** Who may do what inside an organisation. Members (students) only see the organisation itself. */
const MATRIX: Record<OrgRole, readonly OrgAction[]> = {
  owner: ORG_ACTIONS,
  admin: ORG_ACTIONS,
  reviewer: ["org.view", "members.view", "cohort.view", "cv.review"],
  recruiter: ["org.view", "members.view", "candidates.view", "candidates.manage"],
  member: ["org.view"],
};

export const isOrgRole = (v: unknown): v is OrgRole => typeof v === "string" && (ORG_ROLES as readonly string[]).includes(v);
export const isOrgKind = (v: unknown): v is OrgKind => typeof v === "string" && (ORG_KINDS as readonly string[]).includes(v);

export const orgCan = (role: string, action: OrgAction): boolean => isOrgRole(role) && MATRIX[role].includes(action);

/** Roles that make sense for each kind of organisation (shown in pickers). */
export const ROLES_FOR_KIND: Record<OrgKind, OrgRole[]> = {
  university: ["owner", "admin", "reviewer", "member"],
  agency: ["owner", "admin", "recruiter"],
  partner: ["owner", "admin", "reviewer", "recruiter", "member"],
};

export const ROLE_LABEL: Record<OrgRole, string> = {
  owner: "Owner",
  admin: "Admin",
  reviewer: "Reviewer",
  recruiter: "Recruiter",
  member: "Student",
};

/** Only owners may make or remove other owners; admins manage everyone else. */
export function canAssignRole(actor: string, from: string, to: string): boolean {
  if (!orgCan(actor, "members.manage")) return false;
  if (actor === "owner") return true;
  return from !== "owner" && to !== "owner";
}

// ─── Seats ──────────────────────────────────────────────────────────────────

export type SeatHolder = { seat: boolean };

export const seatsUsed = (members: SeatHolder[]): number => members.filter((m) => m.seat).length;

/** Whether one more person can take a seat (staff can join without one). */
export const hasFreeSeat = (seats: number, members: SeatHolder[]): boolean => seatsUsed(members) < seats;

/** Staff roles don't consume a licence; students and recruiters do. */
export const roleTakesSeat = (role: OrgRole): boolean => role === "member" || role === "recruiter";

/**
 * The plan a person gets from their organisations' seats on top of their own plan. Returns null
 * when no seat improves on `current`.
 */
export function seatUpgrade(current: Plan, seatPlans: Plan[]): Plan | null {
  let best: Plan | null = null;
  for (const p of seatPlans) if (!atLeast(current, p) && (!best || !atLeast(best, p))) best = p;
  return best;
}

/** "ali@Uni.edu.pk" → "uni.edu.pk". */
export const emailDomain = (email: string): string => email.trim().toLowerCase().split("@")[1] ?? "";

/** Cleans a list of SSO domains: lower case, no "@" or protocol, valid looking, unique. */
export function normalizeDomains(input: string[]): string[] {
  const out = input
    .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^@/, "").replace(/\/.*$/, ""))
    .filter((d) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d));
  return [...new Set(out)].slice(0, 10);
}
