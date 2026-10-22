import { ASSISTANT, LlmAssistant, OfflineAssistant } from "@cvb/ai";
import { AnthropicTextModel } from "@cvb/ai/anthropic";
import { Global, Logger, Module } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../../config/app-config.js";
import { AiController } from "./ai.controller.js";
import { AiService } from "./ai.service.js";
import { CREDITS_REPOSITORY } from "./credits.repository.js";
import { CreditsService } from "./credits.service.js";
import { PrismaCreditsRepository } from "./prisma-credits.repository.js";

/** Claude when ANTHROPIC_API_KEY is set, otherwise the offline assistant (development, demos). */
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
        if (!config.ANTHROPIC_API_KEY) {
          new Logger("AiModule").warn("ANTHROPIC_API_KEY is not set: using the offline assistant");
          return new OfflineAssistant();
        }
        return new LlmAssistant(
          new AnthropicTextModel({ apiKey: config.ANTHROPIC_API_KEY, models: { fast: config.AI_MODEL_FAST, smart: config.AI_MODEL_SMART } }),
        );
      },
    },
  ],
  exports: [AiService, CreditsService, ASSISTANT],
})
export class AiModule {}
