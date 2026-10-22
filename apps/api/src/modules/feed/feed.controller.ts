import { FeedQuerySchema, JobPreferencesSchema, SaveFeedJobSchema, type FeedQueryDto, type JobPreferencesDto, type SaveFeedJobDto } from "@cvb/contracts";
import { Body, Controller, Get, Post, Put, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { CurrentUser } from "../../common/auth/decorators.js";
import { ZodPipe } from "../../common/validation/zod.pipe.js";
import { FeedService } from "./feed.service.js";

@Controller("feed")
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  search(@CurrentUser() user: AuthUser, @Query(new ZodPipe(FeedQuerySchema)) query: FeedQueryDto) {
    return this.feed.search(user, query);
  }

  @Get("preferences")
  preferences(@CurrentUser() user: AuthUser) {
    return this.feed.preferences(user);
  }

  @Put("preferences")
  savePreferences(@CurrentUser() user: AuthUser, @Body(new ZodPipe(JobPreferencesSchema)) dto: JobPreferencesDto) {
    return this.feed.savePreferences(user, dto);
  }

  @Post("save")
  save(@CurrentUser() user: AuthUser, @Body(new ZodPipe(SaveFeedJobSchema)) dto: SaveFeedJobDto) {
    return this.feed.save(user, dto);
  }

  @Get("salary")
  async salary(@Query("title") title = "", @Query("location") location?: string) {
    return { range: await this.feed.salary(title.slice(0, 120), location?.slice(0, 120)) };
  }
}
