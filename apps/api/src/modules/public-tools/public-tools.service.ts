import { ASSISTANT, type Assistant } from "@cvb/ai";
import {
  ATS_CHECK_MAX_BYTES,
  ATS_CHECK_MAX_TEXT,
  PUBLIC_AI_DAILY_LIMIT,
  type AtsCheckDto,
  type AtsCheckInput,
  type ImproveBulletSchema,
  type PublicAiUsageDto,
  type WithPublicUsage,
  type WriteSummarySchema,
} from "@cvb/contracts";
import { atsReport, matchJob, parseResumeText } from "@cvb/domain";
import { DOCUMENT_EXTENSIONS, ExtractError, extractText, hasReadableText, sniff } from "@cvb/extract";
import { RateLimitedError, ValidationError, wordCount } from "@cvb/shared";
import { Inject, Injectable } from "@nestjs/common";
import type { z } from "zod";
import { AiService } from "../ai/ai.service.js";
import { dailyWindow, USAGE_QUOTA, visitorKey, type UsageQuota } from "./usage-quota.js";

export type Upload = { originalname: string; mimetype: string; size: number; buffer: Buffer };

/** Longest a file may take to read before we give up (a normal CV takes well under a second). */
export const EXTRACT_TIMEOUT_MS = 10_000;
/** A job advert shorter than this has too little to match keywords against. */
const MIN_ADVERT = 30;

class TimeoutError extends Error {}

async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new TimeoutError()), ms)))]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Free tools for visitors without an account. The ATS check reads the CV in the request
 * (nothing is stored, no AI). The AI helpers call the same assistant and honesty guards as the
 * editor, with a small daily allowance per visitor instead of credits.
 */
@Injectable()
export class PublicToolsService {
  /** The clock (tests move it). */
  now: () => Date = () => new Date();
  extractTimeoutMs = EXTRACT_TIMEOUT_MS;

  constructor(
    @Inject(ASSISTANT) private readonly ai: Assistant,
    @Inject(USAGE_QUOTA) private readonly quota: UsageQuota,
    private readonly aiCalls: AiService,
  ) {}

  /* ----------------------------------------------------------------------- ATS check */

  async atsCheck(input: AtsCheckInput, file?: Upload): Promise<AtsCheckDto> {
    let text: string;
    let source: AtsCheckDto["source"];
    if (file) {
      if (file.size > ATS_CHECK_MAX_BYTES) throw new ValidationError("That file is larger than 5 MB");
      const type = sniff(file.buffer, file.originalname);
      if (typeof type !== "string") throw new ValidationError(type.error);
      if (type === "application/json") throw new ValidationError("This is a JSON file. Upload your CV as a PDF, Word, OpenDocument, RTF, HTML or text file, or paste the text.");
      const extracted = await this.read(file.buffer, type);
      text = extracted.text;
      source = { kind: "file", fileType: DOCUMENT_EXTENSIONS[type], pages: extracted.pages ?? null, words: 0 };
    } else if (input.text) {
      text = input.text.replace(/\r/g, "");
      source = { kind: "text", fileType: null, pages: null, words: 0 };
    } else {
      throw new ValidationError("Upload your CV or paste its text");
    }

    text = text.slice(0, ATS_CHECK_MAX_TEXT);
    if (!hasReadableText(text)) {
      throw new ValidationError(
        file
          ? "We couldn't find any text in this file. If it's a scan or a photo, export your CV as a PDF with selectable text or a Word file."
          : "Paste a bit more of your CV so there is something to check.",
      );
    }
    const { cv, warnings } = parseResumeText(text);
    const report = atsReport(cv, { templateAts: true, pages: source.pages ?? undefined });
    const advert = input.jobDescription;
    const match = advert && advert.length >= MIN_ADVERT ? matchJob(cv, { title: input.jobTitle, description: advert }, this.now()) : null;
    return { report, match, cv, warnings, source: { ...source, words: wordCount(text) } };
  }

  private async read(bytes: Buffer, type: Parameters<typeof extractText>[1]) {
    try {
      return await withTimeout(extractText(bytes, type), this.extractTimeoutMs);
    } catch (e) {
      if (e instanceof TimeoutError) throw new ValidationError("This file took too long to read. Save it again as a PDF or Word file, or paste the text instead.");
      if (e instanceof ExtractError) throw new ValidationError(e.message);
      throw e;
    }
  }

  /* ----------------------------------------------------------------------- Free AI writing */

  async usage(ip: string): Promise<PublicAiUsageDto> {
    const { day, resetsAt } = dailyWindow(this.now());
    return this.usageDto(await this.quota.used(visitorKey("ai", ip, day)), resetsAt);
  }

  writeSummary(ip: string, input: z.output<typeof WriteSummarySchema>) {
    // Photos aren't needed to write a summary; don't pass them along.
    const cv = { ...input.cv, photo: "" };
    return this.spend(ip, "write-summary", () => this.ai.writeSummary({ ...input, cv }));
  }

  improveBullet(ip: string, input: z.output<typeof ImproveBulletSchema>) {
    return this.spend(ip, "improve-bullet", () => this.ai.improveBullet(input));
  }

  /** Takes one of today's free uses, runs the call, and gives the use back if the call fails. */
  private async spend<T extends object>(ip: string, label: string, fn: () => Promise<T>): Promise<WithPublicUsage<T>> {
    const { day, resetsAt } = dailyWindow(this.now());
    const key = visitorKey("ai", ip, day);
    const used = await this.quota.take(key, resetsAt);
    if (used > PUBLIC_AI_DAILY_LIMIT) {
      await this.quota.release(key);
      throw new RateLimitedError(`You've used today's ${PUBLIC_AI_DAILY_LIMIT} free AI tries. They start again tomorrow, or create a free account for monthly AI credits.`, {
        limit: PUBLIC_AI_DAILY_LIMIT,
        resetsAt: resetsAt.toISOString(),
      });
    }
    try {
      const out = await this.aiCalls.call(label, fn);
      return { ...out, usage: this.usageDto(used, resetsAt) };
    } catch (e) {
      await this.quota.release(key);
      throw e;
    }
  }

  private usageDto(used: number, resetsAt: Date): PublicAiUsageDto {
    const n = Math.min(used, PUBLIC_AI_DAILY_LIMIT);
    return { limit: PUBLIC_AI_DAILY_LIMIT, used: n, remaining: PUBLIC_AI_DAILY_LIMIT - n, resetsAt: resetsAt.toISOString(), aiConnected: this.ai.name !== "offline" };
  }
}
