import { AnthropicTextModel } from "./anthropic";
import { LlmAssistant } from "./llm-assistant";
import { OfflineAssistant } from "./offline";
import { OllamaTextModel } from "./ollama";
import type { Assistant } from "./types";

export type AiConfig = {
  AI_PROVIDER: "auto" | "anthropic" | "ollama" | "offline";
  ANTHROPIC_API_KEY?: string;
  AI_MODEL_FAST: string;
  AI_MODEL_SMART: string;
  OLLAMA_URL: string;
  OLLAMA_MODEL_FAST: string;
  OLLAMA_MODEL_SMART: string;
};

/**
 * The Assistant for the configured provider (AI_PROVIDER): a local/self-hosted Ollama model,
 * Claude, or the offline stand-in. "auto" is Claude when ANTHROPIC_API_KEY is set, else offline.
 * Shared by the API (writing help) and the worker (reading imported CVs).
 */
export function createAssistant(config: AiConfig, log: { log: (m: string) => void; warn: (m: string) => void } = console): Assistant {
  const provider = config.AI_PROVIDER === "auto" ? (config.ANTHROPIC_API_KEY ? "anthropic" : "offline") : config.AI_PROVIDER;
  if (provider === "ollama") {
    log.log(`Using Ollama at ${config.OLLAMA_URL} (${config.OLLAMA_MODEL_FAST} / ${config.OLLAMA_MODEL_SMART})`);
    return new LlmAssistant(new OllamaTextModel({ url: config.OLLAMA_URL, models: { fast: config.OLLAMA_MODEL_FAST, smart: config.OLLAMA_MODEL_SMART } }), "ollama");
  }
  if (provider === "anthropic" && config.ANTHROPIC_API_KEY) {
    return new LlmAssistant(new AnthropicTextModel({ apiKey: config.ANTHROPIC_API_KEY, models: { fast: config.AI_MODEL_FAST, smart: config.AI_MODEL_SMART } }), "claude");
  }
  log.warn(provider === "anthropic" ? "AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set: using the offline assistant" : "Using the offline assistant (set AI_PROVIDER=ollama, or ANTHROPIC_API_KEY)");
  return new OfflineAssistant();
}
