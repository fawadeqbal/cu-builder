import { DB } from "@cvb/db/nest";
import type { DbClient } from "@cvb/db";
import { JOB_PRODUCER, type JobProducer } from "@cvb/queue";
import { Global, Module } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../../config/app-config.js";
import { AUTH, createBetterAuth } from "./better-auth.js";

/** Provides the Better Auth instance. Its HTTP handler is mounted at /api/auth in main.ts. */
@Global()
@Module({
  providers: [
    {
      provide: AUTH,
      inject: [DB, APP_CONFIG, JOB_PRODUCER],
      useFactory: (db: DbClient, config: AppConfig, jobs: JobProducer) => createBetterAuth({ db, config, jobs }),
    },
  ],
  exports: [AUTH],
})
export class AuthModule {}
