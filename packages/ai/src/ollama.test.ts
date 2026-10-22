import { afterEach, describe, expect, it, vi } from "vitest";
import { LlmAssistant } from "./llm-assistant";
import { listOllamaModels, OllamaTextModel } from "./ollama";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const model = () => new OllamaTextModel({ url: "http://localhost:11434/", models: { fast: "qwen2.5:3b", smart: "qwen2.5:7b" } });

afterEach(() => vi.unstubAllGlobals());

describe("OllamaTextModel", () => {
  it("calls the chat API with the tier's model, system prompt, limits and JSON mode", async () => {
    const fetch = vi.fn(async () => json({ message: { content: ' {"options":["A"]} ' } }));
    vi.stubGlobal("fetch", fetch);
    const out = await model().complete({ system: "rules", messages: [{ role: "user", content: "hi" }], tier: "smart", maxTokens: 300, json: true });
    expect(out).toBe('{"options":["A"]}');
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://localhost:11434/api/chat");
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "qwen2.5:7b",
      stream: false,
      format: "json",
      messages: [{ role: "system", content: "rules" }, { role: "user", content: "hi" }],
      options: { num_predict: 300 },
    });
  });

  it("explains a missing model and an unreachable server", async () => {
    vi.stubGlobal("fetch", async () => json({ error: 'model "qwen2.5:3b" not found, try pulling it first' }, 404));
    await expect(model().complete({ system: "", messages: [], tier: "fast", maxTokens: 10 })).rejects.toThrow("ollama pull qwen2.5:3b");
    vi.stubGlobal("fetch", async () => Promise.reject(new TypeError("fetch failed")));
    await expect(model().complete({ system: "", messages: [], tier: "fast", maxTokens: 10 })).rejects.toThrow("Can't reach Ollama");
  });

  it("drives the assistant end to end", async () => {
    vi.stubGlobal("fetch", async () => json({ message: { content: '{"options":["Cut build time by [%]","Sped up builds","Shipped faster builds"]}' } }));
    const assistant = new LlmAssistant(model(), "ollama");
    expect(assistant.name).toBe("ollama");
    expect((await assistant.improveBullet({ bullet: "made builds faster" })).options).toHaveLength(3);
  });

  it("lists installed models", async () => {
    vi.stubGlobal("fetch", async () => json({ models: [{ name: "qwen2.5:7b" }, { name: "llama3.1:8b" }] }));
    expect(await listOllamaModels("http://x")).toEqual(["llama3.1:8b", "qwen2.5:7b"]);
  });
});
