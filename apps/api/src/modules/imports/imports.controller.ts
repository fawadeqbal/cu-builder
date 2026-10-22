import { IMPORT_MAX_BYTES, IdParamSchema } from "@cvb/contracts";
import { Controller, Get, Param, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { CurrentUser } from "../../common/auth/decorators.js";
import { ZodPipe } from "../../common/validation/zod.pipe.js";
import { ImportsService, type UploadedFile as Upload } from "./imports.service.js";

@Controller("imports")
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  /** multipart/form-data with a `file` field. Kept in memory (≤5 MB), then stored. */
  @Post()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: IMPORT_MAX_BYTES + 1, files: 1 } }))
  start(@CurrentUser() user: AuthUser, @UploadedFile() file: Upload | undefined) {
    return this.imports.start(user, file);
  }

  @Get()
  recent(@CurrentUser() user: AuthUser) {
    return this.imports.recent(user);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }) {
    return this.imports.get(user, id);
  }
}
