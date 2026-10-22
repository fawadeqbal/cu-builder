import {
  CreateCoverLetterSchema,
  DraftLetterSchema,
  IdParamSchema,
  UpdateCoverLetterSchema,
  type CreateCoverLetterDto,
  type DraftLetterDto,
  type UpdateCoverLetterDto,
} from "@cvb/contracts";
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { CurrentUser, Public } from "../../common/auth/decorators.js";
import { ZodPipe } from "../../common/validation/zod.pipe.js";
import { CoverLettersService } from "./cover-letters.service.js";

@Controller()
export class CoverLettersController {
  constructor(private readonly letters: CoverLettersService) {}

  @Get("cover-letters")
  list(@CurrentUser() user: AuthUser) {
    return this.letters.list(user);
  }

  @Post("cover-letters")
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(CreateCoverLetterSchema)) dto: CreateCoverLetterDto) {
    return this.letters.create(user, dto);
  }

  @Post("cover-letters/draft")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  draft(@CurrentUser() user: AuthUser, @Body(new ZodPipe(DraftLetterSchema)) dto: DraftLetterDto) {
    return this.letters.draft(user, dto);
  }

  @Get("cover-letters/:id")
  get(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }) {
    return this.letters.get(user, id);
  }

  @Patch("cover-letters/:id")
  update(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }, @Body(new ZodPipe(UpdateCoverLetterSchema)) dto: UpdateCoverLetterDto) {
    return this.letters.update(user, id, dto);
  }

  @Delete("cover-letters/:id")
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }) {
    return this.letters.remove(user, id);
  }

  @Public()
  @Get("public/l/:slug")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  view(@Param("slug") slug: string) {
    return this.letters.publicView(slug.slice(0, 80));
  }
}
