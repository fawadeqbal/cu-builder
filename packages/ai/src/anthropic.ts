import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, ModelTier, TextModel } from "./types";

export type AnthropicOptions = {
  apiKey: string;
  /** Model ids per tier, e.g. { fast: "claude-haiku-5-5", smart: "claude-sonnet-5-5" }. */
  models: Record<ModelTier, string>;
  timeoutMs?: number;
};

/** TextModel adapter for the Claude API. The SDK stays inside this file. */
export class AnthropicTextModel implements TextModel {
  private readonly client: Anthropic;

  constructor(private readonly options: AnthropicOptions) {
    this.client = new Anthropic({ apiKey: options.apiKey, timeout: options.timeoutMs ?? 45_000, maxRetries: 1 });
  }

  async complete({ system, messages, tier, maxTokens }: { system: string; messages: ChatMessage[]; tier: ModelTier; maxTokens: number }): Promise<string> {
    const res = await this.client.messages.create({
      model: this.options.models[tier],
      max_tokens: maxTokens,
      system,
      messages,
    });
    return res.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();
  }
}
