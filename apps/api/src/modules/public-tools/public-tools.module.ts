import { Module } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../../config/app-config.js";
import { PublicToolsController } from "./public-tools.controller.js";
import { PublicToolsService } from "./public-tools.service.js";
import { RedisUsageQuota } from "./redis-usage-quota.js";
import { USAGE_QUOTA } from "./usage-quota.js";

/** Free ATS check and AI writing tools (no account). AiService and ASSISTANT come from the global AiModule. */
@Module({
  controllers: [PublicToolsController],
  providers: [
    PublicToolsService,
    { provide: USAGE_QUOTA, inject: [APP_CONFIG], useFactory: (config: AppConfig) => new RedisUsageQuota(config.REDIS_URL) },
  ],
})
export class PublicToolsModule {}
