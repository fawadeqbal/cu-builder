import { DB } from "@cvb/db/nest";
import { planToDb, planToDomain, type DbClient, type Organization } from "@cvb/db";
import { isOrgKind, isOrgRole, normalizeCV, type OrgRole } from "@cvb/domain";
import { isTemplateId, templateMeta } from "@cvb/templates/catalog";
import { Inject, Injectable } from "@nestjs/common";
import type { InviteRecord, MemberRecord, OrgPatch, OrgRecord, OrgsStore } from "./orgs.store.js";

const toOrg = (o: Organization): OrgRecord => ({
  id: o.id,
  name: o.name,
  slug: o.slug,
  kind: isOrgKind(o.kind) ? o.kind : "partner",
  seats: o.seats,
  seatPlan: planToDomain(o.seatPlan),
  inviteCode: o.inviteCode,
  ssoDomains: o.ssoDomains,
  branding: o.branding && typeof o.branding === "object" && !Array.isArray(o.branding) ? (o.branding as Record<string, unknown>) : {},
  defaultTemplateId: o.defaultTemplateId,
  createdAt: o.createdAt,
});

const role = (r: string): OrgRole => (isOrgRole(r) ? r : "member");

type MemberRow = { id: string; orgId: string; userId: string; role: string; cohort: string; seat: boolean; createdAt: Date; user: { name: string; email: string } };
const toMember = (m: MemberRow): MemberRecord => ({
  id: m.id,
  orgId: m.orgId,
  userId: m.userId,
  name: m.user.name,
  email: m.user.email,
  role: role(m.role),
  cohort: m.cohort,
  seat: m.seat,
  createdAt: m.createdAt,
});

const toInvite = (i: { id: string; orgId: string; email: string; role: string; cohort: string; token: string; acceptedAt: Date | null; expiresAt: Date; createdAt: Date }): InviteRecord => ({
  ...i,
  role: role(i.role),
});

const withUser = { user: { select: { name: true, email: true } } } as const;
const live = { deletedAt: null } as const;

@Injectable()
export class PrismaOrgsStore implements OrgsStore {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async slugTaken(slug: string) {
    return (await this.db.organization.count({ where: { slug } })) > 0;
  }

  async createOrg(input: { name: string; slug: string; kind: string; inviteCode: string; ownerId: string }) {
    const org = await this.db.organization.create({
      data: {
        name: input.name,
        slug: input.slug,
        kind: input.kind,
        inviteCode: input.inviteCode,
        members: { create: { userId: input.ownerId, role: "owner", seat: false } },
      },
    });
    return toOrg(org);
  }

  async findOrg(id: string) {
    const o = await this.db.organization.findFirst({ where: { id, ...live } });
    return o && toOrg(o);
  }

  async findByInviteCode(code: string) {
    const o = await this.db.organization.findFirst({ where: { inviteCode: code, ...live } });
    return o && toOrg(o);
  }

  async listForUser(userId: string) {
    const rows = await this.db.membership.findMany({ where: { userId, org: live }, include: { org: true }, orderBy: { createdAt: "asc" } });
    return rows.map((m) => ({ ...toOrg(m.org), role: role(m.role) }));
  }

  async updateOrg(id: string, patch: OrgPatch) {
    const { seatPlan, branding, ...rest } = patch;
    const o = await this.db.organization.update({
      where: { id },
      data: { ...rest, ...(seatPlan ? { seatPlan: planToDb(seatPlan) } : {}), ...(branding ? { branding: branding as object } : {}) },
    });
    return toOrg(o);
  }

  async deleteOrg(id: string) {
    await this.db.organization.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async membership(orgId: string, userId: string) {
    const m = await this.db.membership.findUnique({ where: { orgId_userId: { orgId, userId } }, include: withUser });
    return m && toMember(m);
  }

  async members(orgId: string) {
    return (await this.db.membership.findMany({ where: { orgId }, include: withUser, orderBy: { createdAt: "asc" }, take: 20_000 })).map(toMember);
  }

  async findMember(id: string) {
    const m = await this.db.membership.findUnique({ where: { id }, include: withUser });
    return m && toMember(m);
  }

  async addMember(input: { orgId: string; userId: string; role: OrgRole; cohort: string; seat: boolean }) {
    return toMember(await this.db.membership.create({ data: input, include: withUser }));
  }

  async updateMember(id: string, patch: Partial<Pick<MemberRecord, "role" | "cohort" | "seat">>) {
    return toMember(await this.db.membership.update({ where: { id }, data: patch, include: withUser }));
  }

  async removeMember(id: string) {
    await this.db.membership.delete({ where: { id } });
  }

  seatsUsed(orgId: string): Promise<number> {
    return this.db.membership.count({ where: { orgId, seat: true } });
  }

  async invites(orgId: string) {
    return (await this.db.orgInvite.findMany({ where: { orgId }, orderBy: { createdAt: "desc" }, take: 5000 })).map(toInvite);
  }

  async upsertInvite(input: Omit<InviteRecord, "id" | "acceptedAt" | "createdAt">) {
    const { orgId, email, ...rest } = input;
    return toInvite(
      await this.db.orgInvite.upsert({
        where: { orgId_email: { orgId, email } },
        create: { orgId, email, ...rest },
        update: { ...rest, acceptedAt: null },
      }),
    );
  }

  async findInvite(token: string) {
    const i = await this.db.orgInvite.findUnique({ where: { token } });
    return i && toInvite(i);
  }

  async acceptInvite(id: string) {
    await this.db.orgInvite.update({ where: { id }, data: { acceptedAt: new Date() } });
  }

  async deleteInvite(id: string, orgId: string) {
    return (await this.db.orgInvite.deleteMany({ where: { id, orgId } })).count > 0;
  }

  async orgsForDomain(domain: string) {
    return (await this.db.organization.findMany({ where: { ssoDomains: { has: domain }, ...live } })).map(toOrg);
  }

  async cohortInputs(orgId: string) {
    const rows = await this.db.membership.findMany({
      where: { orgId, role: "member" },
      take: 20_000,
      include: {
        user: {
          select: {
            name: true,
            email: true,
            updatedAt: true,
            resumes: {
              where: { deletedAt: null, baseResumeId: null },
              orderBy: { updatedAt: "desc" },
              take: 5,
              select: { id: true, data: true, templateId: true, updatedAt: true },
            },
            applications: { where: { archivedAt: null }, select: { status: true, appliedAt: true, interviewAt: true, updatedAt: true } },
          },
        },
      },
    });
    return rows.map((m) => {
      const dates = [m.user.updatedAt, ...m.user.resumes.map((r) => r.updatedAt), ...m.user.applications.map((a) => a.updatedAt)];
      return {
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        cohort: m.cohort,
        role: m.role,
        resumes: m.user.resumes.map((r) => ({
          id: r.id,
          cv: normalizeCV(r.data),
          templateAts: isTemplateId(r.templateId) ? templateMeta(r.templateId).ats : true,
          updatedAt: r.updatedAt,
        })),
        applications: m.user.applications,
        lastActiveAt: new Date(Math.max(...dates.map((d) => d.getTime()))),
      };
    });
  }

  async seatPlans(userId: string) {
    const rows = await this.db.membership.findMany({ where: { userId, seat: true, org: { ...live, seats: { gt: 0 } } }, select: { org: { select: { seatPlan: true } } } });
    return rows.map((r) => planToDomain(r.org.seatPlan));
  }

  async adminList() {
    const orgs = await this.db.organization.findMany({
      where: live,
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { _count: { select: { members: true } }, members: { where: { seat: true }, select: { id: true } } },
    });
    return orgs.map(({ _count, members, ...o }) => ({ ...toOrg(o), seatsUsed: members.length, memberCount: _count.members }));
  }
}
