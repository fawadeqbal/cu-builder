import {
  AdminUpdateOrgSchema,
  BulkInviteSchema,
  CreateInviteSchema,
  CreateOrgSchema,
  IdParamSchema,
  UpdateMemberSchema,
  UpdateOrgSchema,
  type AdminUpdateOrgDto,
  type CreateInviteDto,
  type CreateOrgDto,
  type UpdateMemberDto,
  type UpdateOrgDto,
} from "@cvb/contracts";
import { Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { z } from "zod";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { CurrentUser, OptionalUser, Public, Roles } from "../../common/auth/decorators.js";
import { ZodPipe } from "../../common/validation/zod.pipe.js";
import { OrgsService } from "./orgs.service.js";

const id = z.string().min(1).max(64);
const MemberParams = z.object({ id, memberId: id });
const InviteParams = z.object({ id, inviteId: id });
const CodeParam = z.object({ code: z.string().min(6).max(64).regex(/^[\w-]+$/) });
const cohortOf = (v?: string) => (v ? v.slice(0, 80) : undefined);

@Controller()
export class OrgsController {
  constructor(private readonly orgs: OrgsService) {}

  @Get("orgs")
  mine(@CurrentUser() user: AuthUser) {
    return this.orgs.mine(user);
  }

  @Post("orgs")
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(CreateOrgSchema)) dto: CreateOrgDto) {
    return this.orgs.create(user, dto);
  }

  @Get("orgs/:id")
  get(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) p: { id: string }) {
    return this.orgs.get(user, p.id);
  }

  @Patch("orgs/:id")
  update(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) p: { id: string }, @Body(new ZodPipe(UpdateOrgSchema)) dto: UpdateOrgDto) {
    return this.orgs.update(user, p.id, dto);
  }

  @Delete("orgs/:id")
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) p: { id: string }) {
    return this.orgs.remove(user, p.id);
  }

  @Get("orgs/:id/members")
  members(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) p: { id: string }) {
    return this.orgs.members(user, p.id);
  }

  @Patch("orgs/:id/members/:memberId")
  updateMember(@CurrentUser() user: AuthUser, @Param(new ZodPipe(MemberParams)) p: z.output<typeof MemberParams>, @Body(new ZodPipe(UpdateMemberSchema)) dto: UpdateMemberDto) {
    return this.orgs.updateMember(user, p.id, p.memberId, dto);
  }

  @Delete("orgs/:id/members/:memberId")
  @HttpCode(204)
  removeMember(@CurrentUser() user: AuthUser, @Param(new ZodPipe(MemberParams)) p: z.output<typeof MemberParams>) {
    return this.orgs.removeMember(user, p.id, p.memberId);
  }

  @Get("orgs/:id/invites")
  invites(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) p: { id: string }) {
    return this.orgs.invites(user, p.id);
  }

  @Post("orgs/:id/invites")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  invite(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) p: { id: string }, @Body(new ZodPipe(CreateInviteSchema)) dto: CreateInviteDto) {
    return this.orgs.invite(user, p.id, dto);
  }

  @Post("orgs/:id/invites/bulk")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  bulkInvite(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) p: { id: string }, @Body(new ZodPipe(BulkInviteSchema)) dto: { csv: string; dryRun: boolean }) {
    return this.orgs.bulkInvite(user, p.id, dto.csv, dto.dryRun);
  }

  @Delete("orgs/:id/invites/:inviteId")
  @HttpCode(204)
  revokeInvite(@CurrentUser() user: AuthUser, @Param(new ZodPipe(InviteParams)) p: z.output<typeof InviteParams>) {
    return this.orgs.revokeInvite(user, p.id, p.inviteId);
  }

  @Get("orgs/:id/cohort")
  cohort(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) p: { id: string }, @Query("cohort") cohort?: string) {
    return this.orgs.cohort(user, p.id, cohortOf(cohort));
  }

  @Get("orgs/:id/cohort.csv")
  @Header("content-type", "text/csv; charset=utf-8")
  @Header("content-disposition", 'attachment; filename="cohort.csv"')
  cohortCsv(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) p: { id: string }, @Query("cohort") cohort?: string) {
    return this.orgs.cohortCsv(user, p.id, cohortOf(cohort));
  }

  @Public()
  @Get("public/join/:code")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  preview(@Param(new ZodPipe(CodeParam)) p: { code: string }, @OptionalUser() user?: AuthUser) {
    return this.orgs.preview(p.code, user);
  }

  @Post("join/:code")
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  join(@CurrentUser() user: AuthUser, @Param(new ZodPipe(CodeParam)) p: { code: string }) {
    return this.orgs.join(user, p.code);
  }

  @Get("admin/orgs")
  @Roles("admin")
  adminList() {
    return this.orgs.adminList();
  }

  @Patch("admin/orgs/:id")
  @Roles("admin")
  adminUpdate(@Param(new ZodPipe(IdParamSchema)) p: { id: string }, @Body(new ZodPipe(AdminUpdateOrgSchema)) dto: AdminUpdateOrgDto) {
    return this.orgs.adminUpdate(p.id, dto);
  }
}
