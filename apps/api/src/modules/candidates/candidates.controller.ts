import { CANDIDATE_BATCH_MAX, IMPORT_MAX_BYTES, UpdateCandidateSchema, type UpdateCandidateDto } from "@cvb/contracts";
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UploadedFiles, UseInterceptors } from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { z } from "zod";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { CurrentUser } from "../../common/auth/decorators.js";
import { ZodPipe } from "../../common/validation/zod.pipe.js";
import { CandidatesService, type UploadedFile } from "./candidates.service.js";

const id = z.string().min(1).max(64);
const OrgParam = z.object({ id });
const CandidateParams = z.object({ id, candidateId: id });

@Controller("orgs/:id/candidates")
export class CandidatesController {
  constructor(private readonly candidates: CandidatesService) {}

  /** multipart/form-data with up to 50 `files`, each a PDF or DOCX of at most 5 MB. */
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(FilesInterceptor("files", CANDIDATE_BATCH_MAX, { limits: { fileSize: IMPORT_MAX_BYTES + 1, files: CANDIDATE_BATCH_MAX } }))
  upload(@CurrentUser() user: AuthUser, @Param(new ZodPipe(OrgParam)) p: { id: string }, @UploadedFiles() files: UploadedFile[] | undefined) {
    return this.candidates.upload(user, p.id, files ?? []);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Param(new ZodPipe(OrgParam)) p: { id: string }, @Query("batch") batch?: string) {
    return this.candidates.list(user, p.id, batch?.slice(0, 64) || undefined);
  }

  @Get(":candidateId")
  get(@CurrentUser() user: AuthUser, @Param(new ZodPipe(CandidateParams)) p: z.output<typeof CandidateParams>) {
    return this.candidates.get(user, p.id, p.candidateId);
  }

  @Patch(":candidateId")
  update(@CurrentUser() user: AuthUser, @Param(new ZodPipe(CandidateParams)) p: z.output<typeof CandidateParams>, @Body(new ZodPipe(UpdateCandidateSchema)) dto: UpdateCandidateDto) {
    return this.candidates.update(user, p.id, p.candidateId, dto);
  }

  @Delete(":candidateId")
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param(new ZodPipe(CandidateParams)) p: z.output<typeof CandidateParams>) {
    return this.candidates.remove(user, p.id, p.candidateId);
  }
}
