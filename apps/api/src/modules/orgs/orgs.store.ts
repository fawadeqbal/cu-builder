import type { OrgKind, OrgRole, Plan, StudentInput } from "@cvb/domain";

export type OrgRecord = {
  id: string;
  name: string;
  slug: string;
  kind: OrgKind;
  seats: number;
  seatPlan: Plan;
  inviteCode: string;
  ssoDomains: string[];
  branding: Record<string, unknown>;
  defaultTemplateId: string | null;
  createdAt: Date;
};

export type MemberRecord = {
  id: string;
  orgId: string;
  userId: string;
  name: string;
  email: string;
  role: OrgRole;
  cohort: string;
  seat: boolean;
  createdAt: Date;
};

export type InviteRecord = {
  id: string;
  orgId: string;
  email: string;
  role: OrgRole;
  cohort: string;
  token: string;
  acceptedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
};

export type OrgPatch = Partial<Pick<OrgRecord, "name" | "ssoDomains" | "branding" | "defaultTemplateId" | "seats" | "seatPlan" | "kind">>;

/** Persistence port for organisations, members and invites. */
export interface OrgsStore {
  slugTaken(slug: string): Promise<boolean>;
  createOrg(input: { name: string; slug: string; kind: OrgKind; inviteCode: string; ownerId: string }): Promise<OrgRecord>;
  findOrg(id: string): Promise<OrgRecord | null>;
  findByInviteCode(code: string): Promise<OrgRecord | null>;
  listForUser(userId: string): Promise<(OrgRecord & { role: OrgRole })[]>;
  updateOrg(id: string, patch: OrgPatch): Promise<OrgRecord>;
  deleteOrg(id: string): Promise<void>;

  membership(orgId: string, userId: string): Promise<MemberRecord | null>;
  members(orgId: string): Promise<MemberRecord[]>;
  findMember(id: string): Promise<MemberRecord | null>;
  addMember(input: { orgId: string; userId: string; role: OrgRole; cohort: string; seat: boolean }): Promise<MemberRecord>;
  updateMember(id: string, patch: Partial<Pick<MemberRecord, "role" | "cohort" | "seat">>): Promise<MemberRecord>;
  removeMember(id: string): Promise<void>;
  seatsUsed(orgId: string): Promise<number>;

  invites(orgId: string): Promise<InviteRecord[]>;
  upsertInvite(input: Omit<InviteRecord, "id" | "acceptedAt" | "createdAt">): Promise<InviteRecord>;
  findInvite(token: string): Promise<InviteRecord | null>;
  acceptInvite(id: string): Promise<void>;
  deleteInvite(id: string, orgId: string): Promise<boolean>;

  /** Organisations whose SSO domains include `domain`. */
  orgsForDomain(domain: string): Promise<OrgRecord[]>;
  /** Everyone with the "member" role, with their CVs and applications, for the dashboard. */
  cohortInputs(orgId: string): Promise<StudentInput[]>;
  /** Plans given by the seats a user holds. */
  seatPlans(userId: string): Promise<Plan[]>;
  adminList(): Promise<(OrgRecord & { seatsUsed: number; memberCount: number })[]>;
}

export const ORGS_STORE = Symbol.for("cvb.api.OrgsStore");
