import { ASSISTANT, LlmAssistant, OfflineAssistant } from "@cvb/ai";
import { AnthropicTextModel } from "@cvb/ai/anthropic";
import { OllamaTextModel } from "@cvb/ai/ollama";
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
        const provider = config.AI_PROVIDER === "auto" ? (config.ANTHROPIC_API_KEY ? "anthropic" : "offline") : config.AI_PROVIDER;
        if (provider === "ollama") {
          log.log(`Using Ollama at ${config.OLLAMA_URL} (${config.OLLAMA_MODEL_FAST} / ${config.OLLAMA_MODEL_SMART})`);
          return new LlmAssistant(new OllamaTextModel({ url: config.OLLAMA_URL, models: { fast: config.OLLAMA_MODEL_FAST, smart: config.OLLAMA_MODEL_SMART } }), "ollama");
        }
        if (provider === "anthropic" && config.ANTHROPIC_API_KEY) {
          return new LlmAssistant(new AnthropicTextModel({ apiKey: config.ANTHROPIC_API_KEY, models: { fast: config.AI_MODEL_FAST, smart: config.AI_MODEL_SMART } }), "claude");
        }
        log.warn(provider === "anthropic" ? "AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set: using the offline assistant" : "Using the offline assistant (set ANTHROPIC_API_KEY, or AI_PROVIDER=ollama)");
        return new OfflineAssistant();
      },
    },
  ],
  exports: [AiService, CreditsService, ASSISTANT],
})
export class AiModule {}
