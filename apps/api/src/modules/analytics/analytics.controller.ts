import { TrackSchema, type TrackDto } from "@cvb/contracts";
import { Body, Controller, HttpCode, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { OptionalUser, Public } from "../../common/auth/decorators.js";
import { ZodPipe } from "../../common/validation/zod.pipe.js";
import { AnalyticsService } from "./analytics.service.js";

/** Product events from the web app and the extension: batched, no personal data, no IP stored. */
@Controller("events")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post()
  @HttpCode(204)
  async track(@OptionalUser() user: AuthUser | undefined, @Req() req: Request, @Body(new ZodPipe(TrackSchema)) dto: TrackDto) {
    await this.analytics.track(dto, { userId: user?.id ?? null, userAgent: req.headers["user-agent"], headers: req.headers });
  }
}
