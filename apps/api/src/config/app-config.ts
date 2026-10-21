import { ApiEnvSchema, loadEnv, type ApiEnv } from "@cvb/config";
import { Global, Module } from "@nestjs/common";

/** Injection token for the validated environment: `@Inject(APP_CONFIG) config: ApiEnv`. */
export const APP_CONFIG = Symbol.for("cvb.api.AppConfig");
export type AppConfig = ApiEnv;

/** Validates the environment once at start-up and shares the typed result. */
@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: (): AppConfig => loadEnv(ApiEnvSchema) }],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}
