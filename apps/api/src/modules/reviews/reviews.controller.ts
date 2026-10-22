import {
  AdminReviewsQuerySchema,
  IdParamSchema,
  ModerateReviewSchema,
  PublicReviewsQuerySchema,
  SaveReviewSchema,
  type AdminReviewsQuery,
  type ModerateReviewDto,
  type PublicReviewsQuery,
  type SaveReviewDto,
} from "@cvb/contracts";
import { Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Put, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { CurrentUser, Public, Roles } from "../../common/auth/decorators.js";
import { ZodPipe } from "../../common/validation/zod.pipe.js";
import { ReviewsService } from "./reviews.service.js";

@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  /** The signed-in user's own review, or null. */
  @Get("reviews/me")
  async mine(@CurrentUser() user: AuthUser) {
    return { review: await this.reviews.mine(user) };
  }

  @Put("reviews/me")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  save(@CurrentUser() user: AuthUser, @Body(new ZodPipe(SaveReviewSchema)) dto: SaveReviewDto) {
    return this.reviews.save(user, dto);
  }

  @Delete("reviews/me")
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser) {
    await this.reviews.remove(user);
  }

  /** Approved reviews, newest first. */
  @Public()
  @Get("public/reviews")
  @Header("cache-control", "public, max-age=300")
  approved(@Query(new ZodPipe(PublicReviewsQuerySchema)) query: PublicReviewsQuery) {
    return this.reviews.approved(query);
  }

  @Roles("admin")
  @Get("admin/reviews")
  adminList(@Query(new ZodPipe(AdminReviewsQuerySchema)) query: AdminReviewsQuery) {
    return this.reviews.adminList(query);
  }

  @Roles("admin")
  @Patch("admin/reviews/:id")
  moderate(
    @Param(new ZodPipe(IdParamSchema)) { id }: { id: string },
    @Body(new ZodPipe(ModerateReviewSchema)) dto: ModerateReviewDto,
  ) {
    return this.reviews.moderate(id, dto.status);
  }
}
