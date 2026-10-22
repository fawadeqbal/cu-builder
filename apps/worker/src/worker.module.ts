import { DatabaseModule } from "@cvb/db/nest";
import { QueueModule } from "@cvb/queue/nest";
import { Module } from "@nestjs/common";
import { WORKER_CONFIG, WorkerConfigModule, type WorkerConfig } from "./config/worker-config.js";
import { EmailModule } from "./email/email.module.js";
import { MaintenanceModule } from "./maintenance/maintenance.module.js";
import { ResumeImportModule } from "./resume-import/resume-import.module.js";

/** One module per queue. Add AI, export and notification queues the same way. */
@Module({
  imports: [
    WorkerConfigModule,
    DatabaseModule.forRootAsync({
      inject: [WORKER_CONFIG],
      useFactory: (config: WorkerConfig) => ({ url: config.DATABASE_URL }),
    }),
    QueueModule.forRootAsync({
      inject: [WORKER_CONFIG],
      useFactory: (config: WorkerConfig) => ({ redisUrl: config.REDIS_URL }),
    }),
    EmailModule,
    ResumeImportModule,
    MaintenanceModule,
  ],
})
export class WorkerModule {}
