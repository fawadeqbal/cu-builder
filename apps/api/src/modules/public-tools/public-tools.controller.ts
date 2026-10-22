import { ATS_CHECK_MAX_BYTES, AtsCheckSchema, ATS_CHECKS_PER_HOUR, ImproveBulletSchema, WriteSummarySchema, type AtsCheckInput } from "@cvb/contracts";
import { Body, Controller, createParamDecorator, Get, HttpCode, Post, UploadedFile, UseInterceptors, type ExecutionContext } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import type { z } from "zod";
import { Public } from "../../common/auth/decorators.js";
import { ZodPipe } from "../../common/validation/zod.pipe.js";
import { PublicToolsService, type Upload } from "./public-tools.service.js";

/** The visitor's address (behind Caddy: `trust proxy` makes this the client, not the proxy). */
const ClientIp = createParamDecorator((_: unknown, ctx: ExecutionContext): string => ctx.switchToHttp().getRequest<Request>().ip ?? "");

/**
 * Free tools for visitors without an account: the ATS check (no AI, nothing stored, 10 an hour
 * per IP) and AI writing helpers (3 a day per IP, counted in Redis). Signed-in people use the
 * /ai endpoints and their credits instead.
 */
@Public()
@Controller("public")
export class PublicToolsController {
  constructor(private readonly tools: PublicToolsService) {}

  /** multipart/form-data with an optional `file` plus text fields, or JSON `{ text, jobTitle, jobDescription }`. */
  @Post("ats-check")
  @HttpCode(200)
  @Throttle({ default: { limit: ATS_CHECKS_PER_HOUR, ttl: 3_600_000 } })
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: ATS_CHECK_MAX_BYTES + 1, files: 1, fields: 6, fieldSize: 200 * 1024 } }))
  atsCheck(@UploadedFile() file: Upload | undefined, @Body(new ZodPipe(AtsCheckSchema.prefault({}))) body: AtsCheckInput) {
    return this.tools.atsCheck(body, file);
  }

  @Get("ai/usage")
  aiUsage(@ClientIp() ip: string) {
    return this.tools.usage(ip);
  }

  @Post("ai/write-summary")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  writeSummary(@ClientIp() ip: string, @Body(new ZodPipe(WriteSummarySchema)) dto: z.output<typeof WriteSummarySchema>) {
    return this.tools.writeSummary(ip, dto);
  }

  @Post("ai/improve-bullet")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  improveBullet(@ClientIp() ip: string, @Body(new ZodPipe(ImproveBulletSchema)) dto: z.output<typeof ImproveBulletSchema>) {
    return this.tools.improveBullet(ip, dto);
  }
}
