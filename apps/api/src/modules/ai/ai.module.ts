import { ASSISTANT } from "@cvb/ai";
import { createAssistant } from "@cvb/ai/factory";
import { Global, Logger, Module } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../../config/app-config.js";
import { AiController } from "./ai.controller.js";
import { AiService } from "./ai.service.js";
import { CREDITS_REPOSITORY } from "./credits.repository.js";
import { CreditsService } from "./credits.service.js";
import { PrismaCreditsRepository } from "./prisma-credits.repository.js";

/**
 * The AI provider (AI_PROVIDER): Claude, a local/self-hosted Ollama model, or the offline
 * assistant (development, demos). "auto" is Claude when ANTHROPIC_API_KEY is set, else offline.
 */
@Global()
@Module({
  controllers: [AiController],
  providers: [
    AiService,
    CreditsService,
    { provide: CREDITS_REPOSITORY, useClass: PrismaCreditsRepository },
    {
      provide: ASSISTANT,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => {
        const log = new Logger("AiModule");
        return createAssistant(config, { log: (m) => log.log(m), warn: (m) => log.warn(m) });
      },
    },
  ],
  exports: [AiService, CreditsService, ASSISTANT],
})
export class AiModule {}
