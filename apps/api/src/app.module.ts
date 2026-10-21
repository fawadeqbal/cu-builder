import { DatabaseModule } from "@cvb/db/nest";
import { QueueModule } from "@cvb/queue/nest";
import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { AuthGuard } from "./common/auth/auth.guard.js";
import { AppExceptionFilter } from "./common/errors/app-exception.filter.js";
import { RequestIdMiddleware } from "./common/http/request-id.middleware.js";
import { APP_CONFIG, AppConfigModule, type AppConfig } from "./config/app-config.js";
import { HealthModule } from "./modules/health/health.module.js";
import { ResumesModule } from "./modules/resumes/resumes.module.js";
import { UsersModule } from "./modules/users/users.module.js";

/**
 * Composition root: infrastructure modules first (config, database, queues), then one module
 * per feature. Features never import each other's internals, only exported services.
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
    HealthModule,
    UsersModule,
    ResumesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: AppExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes("*path");
  }
}
