import type { CV } from "@cvb/domain";

/** Which model class a task needs: quick edits use the fast one, drafts and judgement the smart one. */
export type ModelTier = "fast" | "smart";

export type ChatMessage = { role: "user" | "assistant"; content: string };

/** Port: any text-generation model. The Claude adapter lives in `@cvb/ai/anthropic`. */
export interface TextModel {
  complete(request: { system: string; messages: ChatMessage[]; tier: ModelTier; maxTokens: number }): Promise<string>;
}

export type RewriteMode = "grammar" | "shorter" | "formal" | "confident";
export type LetterTone = "formal" | "warm" | "concise";
export type LetterLength = "short" | "medium" | "long";

export type JobInput = { title: string; company: string; description: string };

export type LetterDraft = { greeting: string; paragraphs: string[]; closing: string };

export type InterviewQuestion = { question: string; competency: string; tip: string };

export type AnswerFeedback = {
  scores: { structure: number; relevance: number; clarity: number };
  feedback: string;
  improved: string;
};

export type StarStory = { situation: string; task: string; action: string; result: string };

/**
 * What the product can ask of AI. Two implementations: `LlmAssistant` (prompts over a TextModel,
 * e.g. Claude) and `OfflineAssistant` (deterministic, for development and tests without a key).
 * Every implementation must keep the rules in AI_PRINCIPLES: never invent facts.
 */
export interface Assistant {
  readonly name: string;
  improveBullet(input: { bullet: string; role?: string; company?: string }): Promise<{ options: string[] }>;
  writeSummary(input: { cv: CV; targetTitle?: string }): Promise<{ options: string[] }>;
  rewrite(input: { text: string; mode: RewriteMode }): Promise<{ text: string }>;
  suggestSkills(input: { cv: CV; targetTitle?: string }): Promise<{ skills: string[] }>;
  tailor(input: { cv: CV; job: JobInput; missing: string[] }): Promise<{ cv: CV; notes: string[] }>;
  coverLetter(input: { cv: CV; job: JobInput; tone: LetterTone; length: LetterLength }): Promise<LetterDraft>;
  interviewQuestions(input: { role: string; seniority?: string; description?: string; count: number }): Promise<{ questions: InterviewQuestion[] }>;
  interviewFeedback(input: { role: string; question: string; answer: string }): Promise<AnswerFeedback>;
  starStory(input: { bullet: string; role: string; company: string }): Promise<StarStory>;
  companyBrief(input: { company: string; role: string; description?: string }): Promise<{ questionsToAsk: string[]; themes: string[] }>;
}

/** Thrown when the model's answer can't be used (bad JSON twice, empty output). */
export class AiOutputError extends Error {
  constructor(message = "The AI answer couldn't be used. Please try again.") {
    super(message);
    this.name = "AiOutputError";
  }
}
