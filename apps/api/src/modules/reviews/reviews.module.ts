import { Module } from "@nestjs/common";
import { PrismaReviewsRepository } from "./prisma-reviews.repository.js";
import { ReviewsController } from "./reviews.controller.js";
import { REVIEWS_REPOSITORY, type ReviewsRepository } from "./reviews.repository.js";
import { ReviewsService } from "./reviews.service.js";

@Module({
  controllers: [ReviewsController],
  providers: [
    { provide: REVIEWS_REPOSITORY, useClass: PrismaReviewsRepository },
    {
      provide: ReviewsService,
      inject: [REVIEWS_REPOSITORY],
      useFactory: (repo: ReviewsRepository) => new ReviewsService(repo),
    },
  ],
})
export class ReviewsModule {}
