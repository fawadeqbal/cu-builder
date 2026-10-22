import type {
  AdminOrgDto,
  AdminUpdateOrgDto,
  BulkInviteResultDto,
  CohortDto,
  CreateInviteDto,
  CreateOrgDto,
  InviteDto,
  JoinPreviewDto,
  MemberDto,
  OrgDto,
  UpdateMemberDto,
  UpdateOrgDto,
} from "@cvb/contracts";
import { QUEUES } from "@cvb/contracts";
import {
  canAssignRole,
  cohortMetrics,
  emailDomain,
  normalizeDomains,
  orgCan,
  parseInviteCsv,
  roleTakesSeat,
  studentRow,
  toCsv,
  type OrgAction,
  type OrgRole,
} from "@cvb/domain";
import { JOB_PRODUCER, type JobProducer } from "@cvb/queue";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError, slugify } from "@cvb/shared";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { APP_CONFIG, type AppConfig } from "../../config/app-config.js";
import { ORGS_STORE, type InviteRecord, type MemberRecord, type OrgRecord, type OrgsStore } from "./orgs.store.js";

const INVITE_DAYS = 14;
const MAX_ORGS_PER_USER = 10;

const token = (bytes = 18) => randomBytes(bytes).toString("base64url");
const brandOf = (b: Record<string, unknown>) => ({
  ...(typeof b.productName === "string" ? { productName: b.productName } : {}),
  ...(typeof b.logoUrl === "string" ? { logoUrl: b.logoUrl } : {}),
  ...(typeof b.primaryColor === "string" ? { primaryColor: b.primaryColor } : {}),
  ...(typeof b.accentColor === "string" ? { accentColor: b.accentColor } : {}),
  ...(Array.isArray(b.templateIds) ? { templateIds: b.templateIds.filter((x): x is string => typeof x === "string") } : {}),
  ...(typeof b.hideBrand === "boolean" ? { hideBrand: b.hideBrand } : {}),
});

const memberDto = (m: MemberRecord): MemberDto => ({
  id: m.id,
  userId: m.userId,
  name: m.name,
  email: m.email,
  role: m.role,
  cohort: m.cohort,
  seat: m.seat,
  createdAt: m.createdAt.toISOString(),
});

const inviteDto = (i: InviteRecord): InviteDto => ({
  id: i.id,
  email: i.email,
  role: i.role,
  cohort: i.cohort,
  acceptedAt: i.acceptedAt?.toISOString() ?? null,
  expiresAt: i.expiresAt.toISOString(),
  createdAt: i.createdAt.toISOString(),
});

/**
 * Organisations: universities and career centres (students, reviewers, cohort dashboard) and
 * agencies (recruiters; candidates live in the candidates module). Seats are licences that
 * lift a member's plan to the organisation's seat plan.
 */
@Injectable()
export class OrgsService {
  private readonly logger = new Logger(OrgsService.name);

  constructor(
    @Inject(ORGS_STORE) private readonly store: OrgsStore,
    @Inject(JOB_PRODUCER) private readonly jobs: JobProducer,
    @Inject(APP_CONFIG) private readonly config: Pick<AppConfig, "APP_URL">,
  ) {}

  // ─── Organisations ────────────────────────────────────────────────────────

  async mine(user: AuthUser): Promise<OrgDto[]> {
    const orgs = await this.store.listForUser(user.id);
    return Promise.all(orgs.map((o) => this.toDto(o, o.role)));
  }

  async create(user: AuthUser, dto: CreateOrgDto): Promise<OrgDto> {
    if ((await this.store.listForUser(user.id)).filter((o) => o.role === "owner").length >= MAX_ORGS_PER_USER) {
      throw new ValidationError("You own 10 organisations already");
    }
    const base = slugify(dto.name, "org").slice(0, 40);
    let slug = base;
    while (await this.store.slugTaken(slug)) slug = `${base}-${token(3).toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    const org = await this.store.createOrg({ name: dto.name, slug, kind: dto.kind, inviteCode: token(8), ownerId: user.id });
    return this.toDto(org, "owner");
  }

  async get(user: AuthUser, id: string): Promise<OrgDto> {
    const { org, role } = await this.access(user, id, "org.view");
    return this.toDto(org, role);
  }

  async update(user: AuthUser, id: string, dto: UpdateOrgDto): Promise<OrgDto> {
    const { org, role } = await this.access(user, id, "org.edit");
    const branding = { ...org.branding };
    if (dto.brandName !== undefined) branding.productName = dto.brandName || undefined;
    if (dto.brandLogoUrl !== undefined) {
      if (dto.brandLogoUrl && !/^(https:\/\/|data:image\/(png|jpeg|webp|svg\+xml);base64,)/.test(dto.brandLogoUrl)) {
        throw new ValidationError("The logo must be an https link or an uploaded image");
      }
      branding.logoUrl = dto.brandLogoUrl || undefined;
    }
    const updated = await this.store.updateOrg(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.ssoDomains !== undefined ? { ssoDomains: normalizeDomains(dto.ssoDomains) } : {}),
      ...(dto.defaultTemplateId !== undefined ? { defaultTemplateId: dto.defaultTemplateId } : {}),
      ...(dto.brandName !== undefined || dto.brandLogoUrl !== undefined ? { branding: JSON.parse(JSON.stringify(branding)) as Record<string, unknown> } : {}),
    });
    return this.toDto(updated, role);
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    const { role } = await this.access(user, id, "org.edit");
    if (role !== "owner" && user.role !== "admin") throw new ForbiddenError("Only an owner can delete the organisation");
    await this.store.deleteOrg(id);
  }

  /** Throws unless the user may do `action` in the organisation. Site admins may do anything. */
  async access(user: AuthUser, orgId: string, action: OrgAction): Promise<{ org: OrgRecord; role: OrgRole | null; member: MemberRecord | null }> {
    const org = await this.store.findOrg(orgId);
    if (!org) throw new NotFoundError("Organisation", orgId);
    const member = await this.store.membership(orgId, user.id);
    if (user.role === "admin") return { org, role: member?.role ?? null, member };
    if (!member) throw new NotFoundError("Organisation", orgId);
    if (!orgCan(member.role, action)) throw new ForbiddenError();
    return { org, role: member.role, member };
  }

  // ─── Members ──────────────────────────────────────────────────────────────

  async members(user: AuthUser, orgId: string): Promise<MemberDto[]> {
    await this.access(user, orgId, "members.view");
    return (await this.store.members(orgId)).map(memberDto);
  }

  async updateMember(user: AuthUser, orgId: string, memberId: string, dto: UpdateMemberDto): Promise<MemberDto> {
    const { org, role } = await this.access(user, orgId, "members.manage");
    const target = await this.store.findMember(memberId);
    if (!target || target.orgId !== orgId) throw new NotFoundError("Member", memberId);
    if (dto.role && dto.role !== target.role) {
      if (!canAssignRole(role ?? "owner", target.role, dto.role)) throw new ForbiddenError("Only an owner can change owners");
      if (target.role === "owner") await this.assertAnotherOwner(orgId, target.id);
    }
    if (dto.seat === true && !target.seat && (await this.store.seatsUsed(orgId)) >= org.seats) {
      throw new ValidationError("All seats are taken. Free a seat or ask us for more.");
    }
    return memberDto(await this.store.updateMember(memberId, dto));
  }

  /** Managers remove anyone (except the last owner); everyone may leave. */
  async removeMember(user: AuthUser, orgId: string, memberId: string): Promise<void> {
    const target = await this.store.findMember(memberId);
    if (!target || target.orgId !== orgId) throw new NotFoundError("Member", memberId);
    if (target.userId !== user.id) {
      const { role } = await this.access(user, orgId, "members.manage");
      if (target.role === "owner" && role !== "owner" && user.role !== "admin") throw new ForbiddenError("Only an owner can remove an owner");
    }
    if (target.role === "owner") await this.assertAnotherOwner(orgId, target.id);
    await this.store.removeMember(memberId);
  }

  private async assertAnotherOwner(orgId: string, exceptId: string) {
    if (!(await this.store.members(orgId)).some((m) => m.role === "owner" && m.id !== exceptId)) {
      throw new ValidationError("An organisation needs at least one owner");
    }
  }

  // ─── Invites and joining ──────────────────────────────────────────────────

  async invites(user: AuthUser, orgId: string): Promise<InviteDto[]> {
    await this.access(user, orgId, "invites.send");
    return (await this.store.invites(orgId)).map(inviteDto);
  }

  async invite(user: AuthUser, orgId: string, dto: CreateInviteDto, now = new Date()): Promise<InviteDto> {
    const { org } = await this.access(user, orgId, "invites.send");
    const email = dto.email.trim().toLowerCase();
    const existing = (await this.store.members(orgId)).find((m) => m.email.toLowerCase() === email);
    if (existing) throw new ConflictError(`${email} is already a member`);
    return inviteDto(await this.sendInvite(org, user, { email, role: dto.role, cohort: dto.cohort }, now));
  }

  /** Invites from a CSV (email, role, cohort). `dryRun` only validates, for the preview. */
  async bulkInvite(user: AuthUser, orgId: string, csv: string, dryRun: boolean, now = new Date()): Promise<BulkInviteResultDto> {
    const { org } = await this.access(user, orgId, "invites.send");
    const { rows, errors } = parseInviteCsv(csv, { max: 1000 });
    const members = new Set((await this.store.members(orgId)).map((m) => m.email.toLowerCase()));
    const skipped = rows.filter((r) => members.has(r.email)).map((r) => ({ line: r.line, email: r.email, reason: "Already a member" }));
    const todo = rows.filter((r) => !members.has(r.email));
    if (!dryRun) for (const r of todo) await this.sendInvite(org, user, r, now);
    return { invited: dryRun ? 0 : todo.length, skipped, errors, rows: todo.map(({ line, email, role, cohort }) => ({ line, email, role, cohort })) };
  }

  async revokeInvite(user: AuthUser, orgId: string, inviteId: string): Promise<void> {
    await this.access(user, orgId, "invites.send");
    if (!(await this.store.deleteInvite(inviteId, orgId))) throw new NotFoundError("Invite", inviteId);
  }

  private async sendInvite(org: OrgRecord, from: AuthUser, r: { email: string; role: OrgRole; cohort: string }, now: Date): Promise<InviteRecord> {
    const invite = await this.store.upsertInvite({
      orgId: org.id,
      email: r.email,
      role: r.role,
      cohort: r.cohort,
      token: token(),
      expiresAt: new Date(now.getTime() + INVITE_DAYS * 86_400_000),
    });
    const what = org.kind === "agency" ? "team" : r.role === "member" ? "students" : "career team";
    await this.jobs.enqueue(
      QUEUES.email,
      "send",
      {
        template: "notice",
        to: r.email,
        name: "",
        subject: `${from.name || "Someone"} invited you to ${org.name} on CV Builder`.slice(0, 200),
        lines: [
          `You've been invited to join the ${what} of ${org.name}.`,
          org.kind === "agency" ? "You'll be able to manage candidate CVs with the team." : "Build your CV, track applications and get feedback from the career office.",
          `The invitation expires in ${INVITE_DAYS} days.`,
        ],
        action: { label: "Accept invitation", url: `${this.config.APP_URL}/join/${invite.token}` },
      },
      { jobId: `org-invite-${invite.id}-${invite.token.slice(0, 8)}` },
    );
    return invite;
  }

  /** What /join/<code> shows: an invite token or the organisation's open invite code. */
  async preview(code: string, user: AuthUser | undefined, now = new Date()): Promise<JoinPreviewDto> {
    const { org, invite } = await this.resolveCode(code, now);
    const used = await this.store.seatsUsed(org.id);
    const role = invite?.role ?? (org.kind === "agency" ? "recruiter" : "member");
    return {
      orgName: org.name,
      kind: org.kind,
      role,
      seatsLeft: Math.max(0, org.seats - used),
      logoUrl: typeof org.branding.logoUrl === "string" ? org.branding.logoUrl : null,
      invitedEmail: invite?.email ?? null,
      alreadyMember: user ? Boolean(await this.store.membership(org.id, user.id)) : false,
    };
  }

  async join(user: AuthUser, code: string, now = new Date()): Promise<OrgDto> {
    const { org, invite } = await this.resolveCode(code, now);
    if (invite && invite.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new ForbiddenError(`This invitation is for ${invite.email}. Sign in with that email to accept it.`);
    }
    const existing = await this.store.membership(org.id, user.id);
    if (existing) {
      if (invite) await this.store.acceptInvite(invite.id);
      return this.toDto(org, existing.role);
    }
    const role = invite?.role ?? (org.kind === "agency" ? "recruiter" : "member");
    const member = await this.addWithSeat(org, user.id, role, invite?.cohort ?? "");
    if (invite) await this.store.acceptInvite(invite.id);
    return this.toDto(org, member.role);
  }

  private async resolveCode(code: string, now: Date): Promise<{ org: OrgRecord; invite: InviteRecord | null }> {
    const invite = code.length > 16 ? await this.store.findInvite(code) : null;
    if (invite) {
      if (invite.expiresAt < now && !invite.acceptedAt) throw new ValidationError("This invitation has expired. Ask for a new one.");
      const org = await this.store.findOrg(invite.orgId);
      if (!org) throw new NotFoundError("Organisation", invite.orgId);
      return { org, invite };
    }
    const org = await this.store.findByInviteCode(code);
    if (!org) throw new NotFoundError("Invitation", code);
    return { org, invite: null };
  }

  /** Adds a member; roles that need a licence get one, or the join is refused when none are free. */
  private async addWithSeat(org: OrgRecord, userId: string, role: OrgRole, cohort: string): Promise<MemberRecord> {
    const seat = roleTakesSeat(role);
    if (seat && (await this.store.seatsUsed(org.id)) >= org.seats) {
      throw new ValidationError(`${org.name} has no free seats right now. Ask them to add more.`);
    }
    return this.store.addMember({ orgId: org.id, userId, role, cohort, seat });
  }

  /**
   * Single sign-on: people signing in with a Google or Microsoft account on an organisation's
   * email domain join it as members (while seats last). Quiet on failure.
   */
  async autoJoin(user: { id: string; email: string }): Promise<number> {
    const domain = emailDomain(user.email);
    if (!domain) return 0;
    let joined = 0;
    for (const org of await this.store.orgsForDomain(domain)) {
      if (await this.store.membership(org.id, user.id)) continue;
      try {
        await this.addWithSeat(org, user.id, "member", "");
        joined++;
      } catch (e) {
        this.logger.warn(`SSO join to ${org.slug} skipped for ${user.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return joined;
  }

  // ─── Cohort dashboard ─────────────────────────────────────────────────────

  async cohort(user: AuthUser, orgId: string, cohort?: string, now = new Date()): Promise<CohortDto> {
    await this.access(user, orgId, "cohort.view");
    const inputs = await this.store.cohortInputs(orgId);
    const cohorts = [...new Set(inputs.map((s) => s.cohort).filter(Boolean))].sort();
    const rows = inputs
      .filter((s) => !cohort || s.cohort === cohort)
      .map(studentRow)
      .sort((a, b) => a.name.localeCompare(b.name));
    return { metrics: cohortMetrics(rows, now), cohorts, rows };
  }

  async cohortCsv(user: AuthUser, orgId: string, cohort?: string): Promise<string> {
    await this.access(user, orgId, "cohort.export");
    const { rows } = await this.cohort(user, orgId, cohort);
    return toCsv(
      ["Name", "Email", "Cohort", "CVs", "Best ATS score", "Applications", "Interviews", "Offers", "Placed", "Last active"],
      rows.map((r) => [r.name, r.email, r.cohort, r.cvs, r.bestAts ?? "", r.applications, r.interviews, r.offers, r.placed ? "yes" : "no", r.lastActiveAt?.slice(0, 10) ?? ""]),
    );
  }

  // ─── Site admin ───────────────────────────────────────────────────────────

  async adminList(): Promise<AdminOrgDto[]> {
    return (await this.store.adminList()).map((o) => ({
      id: o.id,
      name: o.name,
      kind: o.kind,
      seats: o.seats,
      seatsUsed: o.seatsUsed,
      seatPlan: o.seatPlan,
      members: o.memberCount,
      createdAt: o.createdAt.toISOString(),
    }));
  }

  async adminUpdate(id: string, dto: AdminUpdateOrgDto): Promise<AdminOrgDto> {
    if (!(await this.store.findOrg(id))) throw new NotFoundError("Organisation", id);
    await this.store.updateOrg(id, dto);
    return (await this.adminList()).find((o) => o.id === id)!;
  }

  private async toDto(org: OrgRecord, role: OrgRole | null): Promise<OrgDto> {
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      kind: org.kind,
      seats: org.seats,
      seatsUsed: await this.store.seatsUsed(org.id),
      seatPlan: org.seatPlan,
      inviteCode: role && orgCan(role, "invites.send") ? org.inviteCode : "",
      ssoDomains: org.ssoDomains,
      defaultTemplateId: org.defaultTemplateId,
      branding: brandOf(org.branding),
      role,
      createdAt: org.createdAt.toISOString(),
    };
  }
}
