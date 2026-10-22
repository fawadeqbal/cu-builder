import {
  TalentContactSchema,
  TalentSearchQuerySchema,
  UpdateTalentProfileSchema,
  type TalentContactDto,
  type TalentSearchQuery,
  type UpdateTalentProfileDto,
} from "@cvb/contracts";
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { z } from "zod";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { CurrentUser } from "../../common/auth/decorators.js";
import { ZodPipe } from "../../common/validation/zod.pipe.js";
import { TalentService } from "./talent.service.js";

const id = z.string().min(1).max(64);
const OrgParam = z.object({ id });
const ProfileParams = z.object({ id, profileId: id });

@Controller()
export class TalentController {
  constructor(private readonly talent: TalentService) {}

  // The job seeker's own "Let recruiters find me" profile.

  @Get("talent/profile")
  profile(@CurrentUser() user: AuthUser) {
    return this.talent.profile(user);
  }

  @Put("talent/profile")
  save(@CurrentUser() user: AuthUser, @Body(new ZodPipe(UpdateTalentProfileSchema)) dto: UpdateTalentProfileDto) {
    return this.talent.saveProfile(user, dto);
  }

  @Delete("talent/profile")
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser) {
    await this.talent.deleteProfile(user);
  }

  // Recruiters in an agency organisation.

  @Get("orgs/:id/talent")
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  search(@CurrentUser() user: AuthUser, @Param(new ZodPipe(OrgParam)) p: { id: string }, @Query(new ZodPipe(TalentSearchQuerySchema)) query: TalentSearchQuery) {
    return this.talent.search(user, p.id, query);
  }

  @Get("orgs/:id/talent/contacts")
  contacts(@CurrentUser() user: AuthUser, @Param(new ZodPipe(OrgParam)) p: { id: string }) {
    return this.talent.contactLog(user, p.id);
  }

  @Get("orgs/:id/talent/:profileId")
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  view(@CurrentUser() user: AuthUser, @Param(new ZodPipe(ProfileParams)) p: { id: string; profileId: string }) {
    return this.talent.view(user, p.id, p.profileId);
  }

  @Post("orgs/:id/talent/:profileId/contact")
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  contact(
    @CurrentUser() user: AuthUser,
    @Param(new ZodPipe(ProfileParams)) p: { id: string; profileId: string },
    @Body(new ZodPipe(TalentContactSchema)) dto: TalentContactDto,
  ) {
    return this.talent.contact(user, p.id, p.profileId, dto);
  }
}
