import {
  ViewPingSchema,
  CreateShareLinkSchema,
  IdParamSchema,
  UnlockShareSchema,
  UpdateShareLinkSchema,
  type CreateShareLinkDto,
  type UpdateShareLinkDto,
} from "@cvb/contracts";
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { Throttle } from "@nestjs/throttler";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { CurrentUser, Public } from "../../common/auth/decorators.js";
import { ZodPipe } from "../../common/validation/zod.pipe.js";
import { ShareLinksService, type Visit } from "./share-links.service.js";

/** What we note about a visit (the IP only to make a daily hash; never stored). */
const visitOf = (req: Request): Visit => ({
  ip: req.ip ?? "",
  userAgent: req.header("user-agent"),
  referrer: req.header("x-page-referrer") ?? undefined,
  country: (req.header("cf-ipcountry") ?? req.header("x-country-code") ?? undefined)?.toUpperCase(),
  host: req.header("x-forwarded-host") ?? req.header("host") ?? undefined,
});

@Controller()
export class ShareLinksController {
  constructor(private readonly links: ShareLinksService) {}

  @Get("resumes/:id/share-links")
  list(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }) {
    return this.links.list(user, id);
  }

  @Post("resumes/:id/share-links")
  create(
    @CurrentUser() user: AuthUser,
    @Param(new ZodPipe(IdParamSchema)) { id }: { id: string },
    @Body(new ZodPipe(CreateShareLinkSchema)) dto: CreateShareLinkDto,
  ) {
    return this.links.create(user, id, dto);
  }

  @Patch("share-links/:id")
  update(
    @CurrentUser() user: AuthUser,
    @Param(new ZodPipe(IdParamSchema)) { id }: { id: string },
    @Body(new ZodPipe(UpdateShareLinkSchema)) dto: UpdateShareLinkDto,
  ) {
    return this.links.update(user, id, dto);
  }

  @Delete("share-links/:id")
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }) {
    await this.links.remove(user, id);
  }

  @Public()
  @Get("public/r/:slug")
  view(@Param("slug") slug: string, @Req() req: Request) {
    return this.links.view(slug, visitOf(req));
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post("public/r/:slug/ping")
  @HttpCode(204)
  async ping(@Param("slug") slug: string, @Body(new ZodPipe(ViewPingSchema)) dto: { viewId: string; durationMs?: number; downloaded?: boolean }) {
    await this.links.ping(slug, dto.viewId, dto);
  }

  @Get("share-links/:id/analytics")
  analytics(@CurrentUser() user: AuthUser, @Param(new ZodPipe(IdParamSchema)) { id }: { id: string }) {
    return this.links.analytics(user, id);
  }

  /** Password attempts are rate-limited per client. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("public/r/:slug/unlock")
  @HttpCode(200)
  unlock(@Param("slug") slug: string, @Body(new ZodPipe(UnlockShareSchema)) { password }: { password: string }, @Req() req: Request) {
    return this.links.view(slug, visitOf(req), password);
  }
}
