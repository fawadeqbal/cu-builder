export * from "./types";
export { AI_PRINCIPLES, LlmAssistant, cvForPrompt, extractJson } from "./llm-assistant";
export { OfflineAssistant } from "./offline";

/** Injection token for the Assistant (bound in the API's AiModule). */
export const ASSISTANT = Symbol.for("cvb.ai.Assistant");
