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
        return createJobFeed(c, (p, e) => log.warn(`${p} failed: ${e instanceof Error ? e.message : String(e)}`));
      },
    },
  ],
})
export class NotificationsModule {}
