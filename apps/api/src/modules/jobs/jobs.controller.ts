import { CreateJobSchema, IdParamSchema, ImportJobUrlSchema, MatchRequestSchema, UpdateJobSchema, type CreateJobDto, type UpdateJobDto } from "@cvb/contracts";
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { CurrentUser } from "../../common/auth/decorators.js";
import { ZodPipe } from "../../common/validation/zod.pipe.js";
import { JobsService } from "./jobs.service.js";

@Controller("jobs")
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.jobs.list(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(CreateJobSchema)) dto: CreateJobDto) {
    return this.jobs.create(user, dto);
  }

  /** Reads a posting from a link (JSON-LD JobPosting or the page text). */
  @Post("import")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  import(@CurrentUser() user: AuthUser, @Body(new ZodPipe(ImportJobUrlSchema)) { url }: { url: string }) {
    return this.jobs.importFromUrl(user, url);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }) {
    return this.jobs.get(user, id);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }, @Body(new ZodPipe(UpdateJobSchema)) dto: UpdateJobDto) {
    return this.jobs.update(user, id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }) {
    return this.jobs.remove(user, id);
  }

  @Post(":id/match")
  @HttpCode(200)
  match(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }, @Body(new ZodPipe(MatchRequestSchema)) { resumeId }: { resumeId: string }) {
    return this.jobs.match(user, id, resumeId);
  }

  @Post(":id/tailor")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  tailor(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }, @Body(new ZodPipe(MatchRequestSchema)) { resumeId }: { resumeId: string }) {
    return this.jobs.tailor(user, id, resumeId);
  }
}
