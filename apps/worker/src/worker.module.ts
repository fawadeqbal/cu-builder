import { DatabaseModule } from "@cvb/db/nest";
import { QueueModule } from "@cvb/queue/nest";
import { Module } from "@nestjs/common";
import { WORKER_CONFIG, WorkerConfigModule, type WorkerConfig } from "./config/worker-config.js";
import { CandidatesModule } from "./candidates/candidates.module.js";
import { EmailModule } from "./email/email.module.js";
import { MaintenanceModule } from "./maintenance/maintenance.module.js";
import { NotificationsModule } from "./notifications/notifications.module.js";
import { ResumeImportModule } from "./resume-import/resume-import.module.js";
import { ServiceOrdersModule } from "./services/services.module.js";

/** One module per queue. */
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
    CandidatesModule,
    MaintenanceModule,
    NotificationsModule,
    ServiceOrdersModule,
  ],
})
export class WorkerModule {}
