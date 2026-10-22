import { AiUnavailableError, type ChatMessage, type ModelTier, type TextModel } from "./types";

export type OllamaOptions = {
  /** Base URL of the Ollama server, e.g. http://localhost:11434. */
  url: string;
  /** Installed model names per tier, e.g. { fast: "qwen2.5:3b", smart: "qwen2.5:7b" }. */
  models: Record<ModelTier, string>;
  timeoutMs?: number;
  /** Context window in tokens; CVs and job ads need more than Ollama's small default. */
  numCtx?: number;
};

/** Models that work well for CV writing on a normal machine (shown in setup docs and errors). */
export const RECOMMENDED_OLLAMA_MODELS = [
  { name: "qwen2.5:7b", note: "Best results; about 5 GB; 16 GB RAM" },
  { name: "llama3.1:8b", note: "Good writing; about 5 GB; 16 GB RAM" },
  { name: "qwen2.5:3b", note: "Faster; about 2 GB; 8 GB RAM" },
];

const base = (url: string) => url.trim().replace(/\/+$/, "");

/**
 * TextModel adapter for a local or self-hosted Ollama server (https://ollama.com): AI writing
 * without sending CVs to a cloud provider and without per-token cost. Uses Ollama's chat API;
 * JSON tasks ask for JSON output, which small models follow much more reliably.
 */
export class OllamaTextModel implements TextModel {
  constructor(private readonly options: OllamaOptions) {}

  async complete({ system, messages, tier, maxTokens, json, schema }: { system: string; messages: ChatMessage[]; tier: ModelTier; maxTokens: number; json?: boolean; schema?: Record<string, unknown> }): Promise<string> {
    const model = this.options.models[tier];
    let res: Response;
    try {
      res = await fetch(`${base(this.options.url)}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 120_000),
        body: JSON.stringify({
          model,
          stream: false,
          // Structured output: a JSON Schema makes even small models return exactly the expected shape.
          ...(schema ? { format: schema } : json ? { format: "json" } : {}),
          messages: [{ role: "system", content: system }, ...messages],
          options: { temperature: 0.4, num_ctx: this.options.numCtx ?? 12_288, num_predict: maxTokens },
        }),
      });
    } catch (e) {
      if (e instanceof Error && e.name === "TimeoutError") throw new AiUnavailableError(`Ollama took too long to answer (model ${model}). Try a smaller model.`);
      throw new AiUnavailableError(`Can't reach Ollama at ${this.options.url}. Is it running? (ollama serve)`);
    }
    if (!res.ok) {
      const detail = await res
        .json()
        .then((b) => (b as { error?: string }).error ?? "")
        .catch(() => "");
      if (res.status === 404 && /model/i.test(detail)) throw new AiUnavailableError(`Ollama doesn't have the model "${model}". Run: ollama pull ${model}`);
      throw new Error(`Ollama error ${res.status}${detail ? `: ${detail}` : ""}`);
    }
    const body = (await res.json()) as { message?: { content?: string } };
    return (body.message?.content ?? "").trim();
  }
}

/** The models installed on an Ollama server (for health checks and setup help). */
export async function listOllamaModels(url: string): Promise<string[]> {
  const res = await fetch(`${base(url)}/api/tags`, { signal: AbortSignal.timeout(5_000) });
  if (!res.ok) throw new Error(`Ollama error ${res.status}`);
  const body = (await res.json()) as { models?: { name: string }[] };
  return (body.models ?? []).map((m) => m.name).sort();
}
