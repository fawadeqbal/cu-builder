import { TrackSchema, type TrackDto } from "@cvb/contracts";
import { DB } from "@cvb/db/nest";
import type { DbClient, Prisma } from "@cvb/db";
import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { OptionalUser, Public } from "../../common/auth/decorators.js";
import { ZodPipe } from "../../common/validation/zod.pipe.js";

/** Funnel events from the web app: an anonymous id, an event name, a few non-personal props. */
@Controller("events")
export class AnalyticsController {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post()
  @HttpCode(204)
  async track(@OptionalUser() user: AuthUser | undefined, @Body(new ZodPipe(TrackSchema)) dto: TrackDto) {
    await this.db.analyticsEvent.createMany({
      data: dto.events.map((e) => ({
        name: e.name,
        anonymousId: dto.anonymousId,
        userId: user?.id ?? null,
        props: (e.props ?? undefined) as Prisma.InputJsonValue | undefined,
      })),
    });
  }
}
