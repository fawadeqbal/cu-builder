import { CreateCommentSchema, IdParamSchema, type CreateCommentDto } from "@cvb/contracts";
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { z } from "zod";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { CurrentUser } from "../../common/auth/decorators.js";
import { ZodPipe } from "../../common/validation/zod.pipe.js";
import { CommentsService } from "./comments.service.js";

const ResolveSchema = z.object({ resolved: z.boolean() });

@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get("review/resumes/:id")
  review(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }) {
    return this.comments.reviewResume(user, id);
  }

  @Get("resumes/:id/comments")
  list(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }) {
    return this.comments.list(user, id);
  }

  @Post("resumes/:id/comments")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  create(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }, @Body(new ZodPipe(CreateCommentSchema)) dto: CreateCommentDto) {
    return this.comments.create(user, id, dto);
  }

  @Patch("comments/:id")
  resolve(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }, @Body(new ZodPipe(ResolveSchema)) { resolved }: { resolved: boolean }) {
    return this.comments.resolve(user, id, resolved);
  }

  @Delete("comments/:id")
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }) {
    return this.comments.remove(user, id);
  }
}
