/**
 * Minimal client for a local Ollama server (https://ollama.com).
 * Runs in the browser: the CV text goes straight from this page to the user's own machine.
 */

export type AiSettings = { url: string; model: string };

export const DEFAULT_AI: AiSettings = { url: "http://localhost:11434", model: "" };

export const RECOMMENDED_MODELS = [
  { name: "qwen2.5:7b", note: "Best results · about 5 GB · 16 GB RAM" },
  { name: "llama3.1:8b", note: "Good writing · about 5 GB · 16 GB RAM" },
  { name: "qwen2.5:3b", note: "Faster · about 2 GB · 8 GB RAM" },
];

const STORAGE_KEY = "cv-builder:ai";

export function loadAiSettings(): AiSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AI;
    const p = JSON.parse(raw) as Partial<AiSettings>;
    return {
      url: typeof p.url === "string" && p.url ? p.url : DEFAULT_AI.url,
      model: typeof p.model === "string" ? p.model : "",
    };
  } catch {
    return DEFAULT_AI;
  }
}

export function saveAiSettings(s: AiSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore: settings just won't persist
  }
}

export class AiError extends Error {
  constructor(
    message: string,
    public kind: "unreachable" | "no-model" | "server" | "aborted" | "bad-output",
  ) {
    super(message);
  }
}

const base = (url: string) => url.trim().replace(/\/+$/, "");

async function request(url: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw new AiError("Stopped.", "aborted");
    throw new AiError(
      "Can't reach Ollama. Make sure it is running and that this site is allowed (see setup help).",
      "unreachable",
    );
  }
  if (res.status === 403) {
    throw new AiError("Ollama blocked this site. Add it to OLLAMA_ORIGINS and restart Ollama (see setup help).", "unreachable");
  }
  if (!res.ok) {
    let detail = "";
    try {
      detail = ((await res.json()) as { error?: string }).error ?? "";
    } catch {
      // not JSON
    }
    if (res.status === 404 && /model/i.test(detail)) {
      throw new AiError(`Model not found. Run “ollama pull <model>” first. (${detail})`, "no-model");
    }
    throw new AiError(detail || `Ollama returned an error (${res.status}).`, "server");
  }
  return res;
}

/** Lists the models installed in Ollama. */
export async function listModels(url: string): Promise<string[]> {
  const res = await request(`${base(url)}/api/tags`);
  const data = (await res.json()) as { models?: { name: string }[] };
  return (data.models ?? []).map((m) => m.name).sort();
}

type ChatOptions = {
  settings: AiSettings;
  system: string;
  prompt: string;
  /** JSON schema the answer must follow (Ollama structured outputs). */
  schema?: object;
  temperature?: number;
  /** Upper limit on the answer length in tokens, so a small model can't run on forever. */
  maxTokens?: number;
  /** Receives the full text so far while the answer streams in. */
  onText?: (textSoFar: string) => void;
  signal?: AbortSignal;
};

/** Sends one chat request and returns the model's full answer. Streams when onText is given. */
export async function chat({ settings, system, prompt, schema, temperature = 0.4, maxTokens = 2048, onText, signal }: ChatOptions) {
  if (!settings.model) throw new AiError("Choose a model in AI settings first.", "no-model");
  const stream = !!onText;
  const res = await request(`${base(settings.url)}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      model: settings.model,
      stream,
      format: schema,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      options: { temperature, num_ctx: 12288, num_predict: maxTokens },
    }),
  });

  if (!stream) {
    const data = (await res.json()) as { message?: { content?: string } };
    return data.message?.content ?? "";
  }

  // Streaming: newline-delimited JSON chunks.
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const chunk = JSON.parse(line) as { message?: { content?: string }; error?: string };
        if (chunk.error) throw new AiError(chunk.error, "server");
        text += chunk.message?.content ?? "";
        onText!(text);
      }
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw new AiError("Stopped.", "aborted");
    throw e;
  }
  return text;
}

/** Sends a request that must come back as JSON matching the schema, and parses it. */
export async function chatJson<T>(
  opts: Omit<ChatOptions, "onText"> & { schema: object; onProgress?: (chars: number) => void },
): Promise<T> {
  const { onProgress, ...rest } = opts;
  const raw = await chat({
    ...rest,
    temperature: opts.temperature ?? 0,
    // Stream internally so the UI can show progress on slow machines.
    onText: (t) => onProgress?.(t.length),
  });
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new AiError("The model's answer wasn't valid JSON. Try again or use a larger model.", "bad-output");
  }
}

/** Turns a model's line-per-item answer into clean bullet strings. */
export function toLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-•*·]|\d+[.)])\s*/, "").trim())
    .filter((l) => l && !/^(here|sure|bullet|improved)/i.test(l) && !l.endsWith(":"));
}
