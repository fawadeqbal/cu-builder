import { createJobFeed, JOB_FEED } from "@cvb/jobfeed";
import { Logger, Module } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../../config/app-config.js";
import { TrackerModule } from "../tracker/tracker.module.js";
import { FeedController } from "./feed.controller.js";
import { FeedService } from "./feed.service.js";

@Module({
  imports: [TrackerModule],
  controllers: [FeedController],
  providers: [
    FeedService,
    {
      provide: JOB_FEED,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => {
        const log = new Logger("JobFeed");
        return createJobFeed(config, (provider, e) => log.warn(`${provider} failed: ${e instanceof Error ? e.message : String(e)}`));
      },
    },
  ],
})
export class FeedModule {}
