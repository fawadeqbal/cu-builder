import type { OrgKind, OrgRole, Plan, StudentInput } from "@cvb/domain";
import type { InviteRecord, MemberRecord, OrgPatch, OrgRecord, OrgsStore } from "./orgs.store.js";

/** For tests: the whole store in memory. */
export class InMemoryOrgsStore implements OrgsStore {
  orgs: OrgRecord[] = [];
  memberships: MemberRecord[] = [];
  inviteList: InviteRecord[] = [];
  users = new Map<string, { name: string; email: string }>();
  students = new Map<string, StudentInput[]>();
  private n = 0;
  private next = (p: string) => `${p}${++this.n}`;

  async slugTaken(slug: string) {
    return this.orgs.some((o) => o.slug === slug);
  }
  async createOrg(input: { name: string; slug: string; kind: OrgKind; inviteCode: string; ownerId: string }) {
    const org: OrgRecord = { id: this.next("o"), name: input.name, slug: input.slug, kind: input.kind, seats: 0, seatPlan: "premium", inviteCode: input.inviteCode, ssoDomains: [], branding: {}, defaultTemplateId: null, createdAt: new Date() };
    this.orgs.push(org);
    await this.addMember({ orgId: org.id, userId: input.ownerId, role: "owner", cohort: "", seat: false });
    return org;
  }
  async findOrg(id: string) {
    return this.orgs.find((o) => o.id === id) ?? null;
  }
  async findByInviteCode(code: string) {
    return this.orgs.find((o) => o.inviteCode === code) ?? null;
  }
  async listForUser(userId: string) {
    return this.memberships.filter((m) => m.userId === userId).map((m) => ({ ...this.orgs.find((o) => o.id === m.orgId)!, role: m.role }));
  }
  async updateOrg(id: string, patch: OrgPatch) {
    const o = this.orgs.find((x) => x.id === id)!;
    Object.assign(o, patch);
    return o;
  }
  async deleteOrg(id: string) {
    this.orgs = this.orgs.filter((o) => o.id !== id);
  }
  async membership(orgId: string, userId: string) {
    return this.memberships.find((m) => m.orgId === orgId && m.userId === userId) ?? null;
  }
  async members(orgId: string) {
    return this.memberships.filter((m) => m.orgId === orgId);
  }
  async findMember(id: string) {
    return this.memberships.find((m) => m.id === id) ?? null;
  }
  async addMember(input: { orgId: string; userId: string; role: OrgRole; cohort: string; seat: boolean }) {
    const u = this.users.get(input.userId) ?? { name: input.userId, email: `${input.userId}@example.com` };
    const m: MemberRecord = { id: this.next("m"), ...input, ...u, createdAt: new Date() };
    this.memberships.push(m);
    return m;
  }
  async updateMember(id: string, patch: Partial<Pick<MemberRecord, "role" | "cohort" | "seat">>) {
    const m = this.memberships.find((x) => x.id === id)!;
    Object.assign(m, patch);
    return m;
  }
  async removeMember(id: string) {
    this.memberships = this.memberships.filter((m) => m.id !== id);
  }
  async seatsUsed(orgId: string) {
    return this.memberships.filter((m) => m.orgId === orgId && m.seat).length;
  }
  async invites(orgId: string) {
    return this.inviteList.filter((i) => i.orgId === orgId);
  }
  async upsertInvite(input: Omit<InviteRecord, "id" | "acceptedAt" | "createdAt">) {
    const old = this.inviteList.find((i) => i.orgId === input.orgId && i.email === input.email);
    if (old) return Object.assign(old, input, { acceptedAt: null });
    const i: InviteRecord = { id: this.next("i"), ...input, acceptedAt: null, createdAt: new Date() };
    this.inviteList.push(i);
    return i;
  }
  async findInvite(token: string) {
    return this.inviteList.find((i) => i.token === token) ?? null;
  }
  async acceptInvite(id: string) {
    this.inviteList.find((i) => i.id === id)!.acceptedAt = new Date();
  }
  async deleteInvite(id: string, orgId: string) {
    const before = this.inviteList.length;
    this.inviteList = this.inviteList.filter((i) => !(i.id === id && i.orgId === orgId));
    return this.inviteList.length < before;
  }
  async orgsForDomain(domain: string) {
    return this.orgs.filter((o) => o.ssoDomains.includes(domain));
  }
  async cohortInputs(orgId: string) {
    return this.students.get(orgId) ?? [];
  }
  async seatPlans(userId: string) {
    return this.memberships
      .filter((m) => m.userId === userId && m.seat)
      .map((m) => this.orgs.find((o) => o.id === m.orgId)!)
      .filter((o) => o.seats > 0)
      .map((o): Plan => o.seatPlan);
  }
  async adminList() {
    return this.orgs.map((o) => ({ ...o, seatsUsed: this.memberships.filter((m) => m.orgId === o.id && m.seat).length, memberCount: this.memberships.filter((m) => m.orgId === o.id).length }));
  }
}
