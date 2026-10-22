import {
  AnswerQuestionSchema,
  IdParamSchema,
  StarFromBulletSchema,
  StarStoryBodySchema,
  StartInterviewSchema,
  type AnswerQuestionDto,
  type StarStoryBodyDto,
  type StartInterviewDto,
} from "@cvb/contracts";
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { z } from "zod";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { CurrentUser } from "../../common/auth/decorators.js";
import { ZodPipe } from "../../common/validation/zod.pipe.js";
import { InterviewsService } from "./interviews.service.js";

const PartialStory = StarStoryBodySchema.partial();

@Controller("interviews")
export class InterviewsController {
  constructor(private readonly interviews: InterviewsService) {}

  @Get("bank")
  bank(@Query("role") role?: string, @Query("family") family?: string, @Query("seniority") seniority?: string, @Query("competency") competency?: string) {
    return this.interviews.bank({ role: role?.slice(0, 120), family, seniority, competency: competency?.slice(0, 60) });
  }

  @Get("sessions")
  sessions(@CurrentUser() user: AuthUser) {
    return this.interviews.sessions(user);
  }

  @Post("sessions")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  start(@CurrentUser() user: AuthUser, @Body(new ZodPipe(StartInterviewSchema)) dto: StartInterviewDto) {
    return this.interviews.start(user, dto);
  }

  @Get("sessions/:id")
  session(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }) {
    return this.interviews.session(user, id);
  }

  @Post("sessions/:id/answer")
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  answer(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }, @Body(new ZodPipe(AnswerQuestionSchema)) dto: AnswerQuestionDto) {
    return this.interviews.answer(user, id, dto);
  }

  @Delete("sessions/:id")
  @HttpCode(204)
  removeSession(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }) {
    return this.interviews.removeSession(user, id);
  }

  @Get("stories")
  stories(@CurrentUser() user: AuthUser) {
    return this.interviews.stories(user);
  }

  @Post("stories")
  createStory(@CurrentUser() user: AuthUser, @Body(new ZodPipe(StarStoryBodySchema)) dto: StarStoryBodyDto) {
    return this.interviews.createStory(user, dto);
  }

  @Post("stories/from-bullet")
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  fromBullet(@CurrentUser() user: AuthUser, @Body(new ZodPipe(StarFromBulletSchema)) dto: z.output<typeof StarFromBulletSchema>) {
    return this.interviews.storyFromBullet(user, dto);
  }

  @Patch("stories/:id")
  updateStory(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }, @Body(new ZodPipe(PartialStory)) dto: Partial<StarStoryBodyDto>) {
    return this.interviews.updateStory(user, id, dto);
  }

  @Delete("stories/:id")
  @HttpCode(204)
  removeStory(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }) {
    return this.interviews.removeStory(user, id);
  }
}
