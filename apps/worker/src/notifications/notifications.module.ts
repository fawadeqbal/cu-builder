import { createJobFeed, JOB_FEED } from "@cvb/jobfeed";
import { Logger, Module } from "@nestjs/common";
import { WORKER_CONFIG, type WorkerConfig } from "../config/worker-config.js";
import { NotificationsProcessor } from "./notifications.processor.js";
import { NOTIFICATIONS_STORE, PrismaNotificationsStore } from "./notifications.store.js";

@Module({
  providers: [
    NotificationsProcessor,
    { provide: NOTIFICATIONS_STORE, useClass: PrismaNotificationsStore },
    {
      provide: JOB_FEED,
      inject: [WORKER_CONFIG],
      useFactory: (c: WorkerConfig) => {
        const log = new Logger("JobFeed");
        const feed = createJobFeed(c, (p, e) => log.warn(`${p} failed: ${e instanceof Error ? e.message : String(e)}`));
        // Load the company career boards in the background so the first search is quick.
        feed.warm();
        return feed;
      },
    },
  ],
})
export class NotificationsModule {}
