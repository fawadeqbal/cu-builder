import { ASSISTANT, AiOutputError, AiUnavailableError, type Assistant } from "@cvb/ai";
import type { ImproveEntrySchema, OrganiseSkillsSchema } from "@cvb/contracts";
import type { CV } from "@cvb/domain";
import { UpstreamError } from "@cvb/shared";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { z } from "zod";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { CreditsService } from "./credits.service.js";

type Mode = "grammar" | "shorter" | "formal" | "confident";

/** Writing help in the editor. Each call is metered; failures from the model become UPSTREAM_FAILED. */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @Inject(ASSISTANT) private readonly ai: Assistant,
    private readonly credits: CreditsService,
  ) {}

  /** Wraps a model call so provider errors surface as one clear, retryable error. */
  async call<T>(label: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      this.logger.warn(`AI ${label} failed: ${e instanceof Error ? e.message : String(e)}`);
      throw new UpstreamError(e instanceof AiOutputError || e instanceof AiUnavailableError ? e.message : "The AI service is busy. Please try again in a moment.");
    }
  }

  improveBullet(user: AuthUser, input: { bullet: string; role?: string; company?: string }) {
    return this.credits.charge(user, "improve-bullet", () => this.call("improve-bullet", () => this.ai.improveBullet(input)));
  }

  writeSummary(user: AuthUser, input: { cv: CV; targetTitle?: string; keywords?: string[] }) {
    return this.credits.charge(user, "write-summary", () => this.call("write-summary", () => this.ai.writeSummary(input)));
  }

  rewrite(user: AuthUser, input: { text: string; mode: Mode }) {
    return this.credits.charge(user, "rewrite", () => this.call("rewrite", () => this.ai.rewrite(input)));
  }

  suggestSkills(user: AuthUser, input: { cv: CV; targetTitle?: string }) {
    return this.credits.charge(user, "suggest-skills", () => this.call("suggest-skills", () => this.ai.suggestSkills(input)));
  }

  improveEntry(user: AuthUser, input: z.output<typeof ImproveEntrySchema>) {
    return this.credits.charge(user, "improve-entry", () => this.call("improve-entry", () => this.ai.improveEntry(input)));
  }

  organiseSkills(user: AuthUser, input: z.output<typeof OrganiseSkillsSchema>) {
    return this.credits.charge(user, "organise-skills", () => this.call("organise-skills", () => this.ai.organiseSkills(input)));
  }

  linkedinProfile(user: AuthUser, input: { cv: CV; targetTitle?: string }) {
    return this.credits.charge(user, "linkedin-profile", () => this.call("linkedin-profile", () => this.ai.linkedinProfile(input)));
  }
}
