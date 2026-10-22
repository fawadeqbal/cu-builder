import { DatabaseModule } from "@cvb/db/nest";
import { QueueModule } from "@cvb/queue/nest";
import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthGuard } from "./common/auth/auth.guard.js";
import { AppExceptionFilter } from "./common/errors/app-exception.filter.js";
import { RequestIdMiddleware } from "./common/http/request-id.middleware.js";
import { APP_CONFIG, AppConfigModule, type AppConfig } from "./config/app-config.js";
import { StorageModule } from "./infrastructure/storage.module.js";
import { AiModule } from "./modules/ai/ai.module.js";
import { AdminModule } from "./modules/admin/admin.module.js";
import { AnalyticsModule } from "./modules/analytics/analytics.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { BillingModule } from "./modules/billing/billing.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { CoverLettersModule } from "./modules/cover-letters/cover-letters.module.js";
import { JobsModule } from "./modules/jobs/jobs.module.js";
import { ImportsModule } from "./modules/imports/imports.module.js";
import { ResumesModule } from "./modules/resumes/resumes.module.js";
import { TemplatesModule } from "./modules/templates/templates.module.js";
import { ShareLinksModule } from "./modules/share-links/share-links.module.js";
import { UsersModule } from "./modules/users/users.module.js";

/**
 * Composition root: infrastructure first (config, database, queues, storage, auth, rate
 * limits), then one module per feature. Features import each other only for exported services.
 */
@Module({
  imports: [
    AppConfigModule,
    DatabaseModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        url: config.DATABASE_URL,
        log: config.LOG_LEVEL === "debug" ? ["query", "warn", "error"] : ["warn", "error"],
      }),
    }),
    QueueModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({ redisUrl: config.REDIS_URL }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    StorageModule,
    TemplatesModule,
    AiModule,
    AuthModule,
    BillingModule,
    HealthModule,
    UsersModule,
    ResumesModule,
    ShareLinksModule,
    ImportsModule,
    JobsModule,
    CoverLettersModule,
    AdminModule,
    AnalyticsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: AppExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes("*path");
  }
}
