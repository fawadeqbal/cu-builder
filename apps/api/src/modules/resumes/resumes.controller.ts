import {
  CreateVersionSchema,
  CreateResumeSchema,
  IdParamSchema,
  PaginationQuerySchema,
  UpdateResumeSchema,
  type CreateResumeDto,
  type CreateVersionDto,
  type PaginationQuery,
  type UpdateResumeDto,
} from "@cvb/contracts";
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { CurrentUser } from "../../common/auth/decorators.js";
import { ZodPipe } from "../../common/validation/zod.pipe.js";
import { ResumesService } from "./resumes.service.js";

/** Thin HTTP adapter: validate with contracts, delegate to the service, return DTOs. */
@Controller("resumes")
export class ResumesController {
  constructor(private readonly resumes: ResumesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query(new ZodPipe(PaginationQuerySchema)) page: PaginationQuery) {
    return this.resumes.list(user, page);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(CreateResumeSchema)) dto: CreateResumeDto) {
    return this.resumes.create(user, dto);
  }

  @Get("trash")
  trash(@CurrentUser() user: AuthUser) {
    return this.resumes.trash(user);
  }

  @Post(":id/restore")
  restore(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }) {
    return this.resumes.restoreFromTrash(user, id);
  }

  @Get(":id/versions")
  versions(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }) {
    return this.resumes.versions(user, id);
  }

  @Post(":id/versions")
  createVersion(
    @CurrentUser() user: AuthUser,
    @Param(new ZodPipe(IdParamSchema)) { id }: { id: string },
    @Body(new ZodPipe(CreateVersionSchema)) dto: CreateVersionDto,
  ) {
    return this.resumes.createVersion(user, id, dto.reason);
  }

  @Post(":id/versions/:versionId/restore")
  restoreVersion(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("versionId") versionId: string,
  ) {
    return this.resumes.restoreVersion(user, id, versionId);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }) {
    return this.resumes.get(user, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param(new ZodPipe(IdParamSchema)) { id }: { id: string },
    @Body(new ZodPipe(UpdateResumeSchema)) dto: UpdateResumeDto,
  ) {
    return this.resumes.update(user, id, dto);
  }

  @Post(":id/duplicate")
  duplicate(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }) {
    return this.resumes.duplicate(user, id);
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }) {
    await this.resumes.remove(user, id);
  }
}
