import { Module } from "@nestjs/common";
import { PrismaPublicStatsRepository } from "./prisma-public-stats.repository.js";
import { PublicStatsController } from "./public-stats.controller.js";
import { PUBLIC_STATS_REPOSITORY, type PublicStatsRepository } from "./public-stats.repository.js";
import { PublicStatsService } from "./public-stats.service.js";

@Module({
  controllers: [PublicStatsController],
  providers: [
    { provide: PUBLIC_STATS_REPOSITORY, useClass: PrismaPublicStatsRepository },
    {
      provide: PublicStatsService,
      inject: [PUBLIC_STATS_REPOSITORY],
      useFactory: (repo: PublicStatsRepository) => new PublicStatsService(repo),
    },
  ],
})
export class PublicStatsModule {}
