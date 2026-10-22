import {
  ImproveBulletSchema,
  ImproveEntrySchema,
  LinkedInProfileRequestSchema,
  OrganiseSkillsSchema,
  RewriteSchema,
  SuggestSkillsSchema,
  WriteSummarySchema,
} from "@cvb/contracts";
import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { z } from "zod";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { CurrentUser } from "../../common/auth/decorators.js";
import { ZodPipe } from "../../common/validation/zod.pipe.js";
import { AiService } from "./ai.service.js";
import { CreditsService } from "./credits.service.js";

/** AI writing help. Signed-in users only; metered by credits; throttled against abuse. */
@Controller("ai")
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly credits: CreditsService,
  ) {}

  @Get("credits")
  balance(@CurrentUser() user: AuthUser) {
    return this.credits.balance(user);
  }

  @Post("improve-bullet")
  @HttpCode(200)
  improveBullet(@CurrentUser() user: AuthUser, @Body(new ZodPipe(ImproveBulletSchema)) dto: z.output<typeof ImproveBulletSchema>) {
    return this.ai.improveBullet(user, dto);
  }

  @Post("write-summary")
  @HttpCode(200)
  writeSummary(@CurrentUser() user: AuthUser, @Body(new ZodPipe(WriteSummarySchema)) dto: z.output<typeof WriteSummarySchema>) {
    return this.ai.writeSummary(user, dto);
  }

  @Post("rewrite")
  @HttpCode(200)
  rewrite(@CurrentUser() user: AuthUser, @Body(new ZodPipe(RewriteSchema)) dto: z.output<typeof RewriteSchema>) {
    return this.ai.rewrite(user, dto);
  }

  @Post("suggest-skills")
  @HttpCode(200)
  suggestSkills(@CurrentUser() user: AuthUser, @Body(new ZodPipe(SuggestSkillsSchema)) dto: z.output<typeof SuggestSkillsSchema>) {
    return this.ai.suggestSkills(user, dto);
  }

  @Post("improve-entry")
  @HttpCode(200)
  improveEntry(@CurrentUser() user: AuthUser, @Body(new ZodPipe(ImproveEntrySchema)) dto: z.output<typeof ImproveEntrySchema>) {
    return this.ai.improveEntry(user, dto);
  }

  @Post("organise-skills")
  @HttpCode(200)
  organiseSkills(@CurrentUser() user: AuthUser, @Body(new ZodPipe(OrganiseSkillsSchema)) dto: z.output<typeof OrganiseSkillsSchema>) {
    return this.ai.organiseSkills(user, dto);
  }

  @Post("linkedin-profile")
  @HttpCode(200)
  linkedinProfile(@CurrentUser() user: AuthUser, @Body(new ZodPipe(LinkedInProfileRequestSchema)) dto: z.output<typeof LinkedInProfileRequestSchema>) {
    return this.ai.linkedinProfile(user, dto);
  }
}
