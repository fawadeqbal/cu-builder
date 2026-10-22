import { OfflineAssistant } from "@cvb/ai";
import { sampleCV } from "@cvb/domain";
import { CreditsExhaustedError } from "@cvb/shared";
import { describe, expect, it } from "vitest";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { AiService } from "./ai.service.js";
import type { CreditsRepository } from "./credits.repository.js";
import { CreditsService } from "./credits.service.js";

class MemoryCredits implements CreditsRepository {
  rows: { delta: number; reason: string }[] = [];
  async usage() {
    return { usedThisMonth: -this.rows.reduce((n, r) => n + r.delta, 0), purchased: 0, purchasedUsed: 0 };
  }
  async spend({ amount, task, pool }: { amount: number; task: string; pool: string }) {
    this.rows.push({ delta: -amount, reason: `ai:${task}:${pool}` });
  }
}

const free: AuthUser = { id: "u", email: "u@x.com", name: "U", role: "user", emailVerified: true, plan: "free", planSource: "base" };

describe("AiService.linkedinProfile", () => {
  it("writes the profile and charges two credits", async () => {
    const repo = new MemoryCredits();
    const assistant = new OfflineAssistant();
    const svc = new AiService(assistant, new CreditsService(repo, assistant));
    const out = await svc.linkedinProfile(free, { cv: sampleCV });
    expect(out.headline).toMatch(/Full Stack Developer/);
    expect(out.experience).toHaveLength(sampleCV.experience.length);
    expect(repo.rows).toEqual([{ delta: -2, reason: "ai:linkedin-profile:allowance" }]);
    expect(out.credits.remaining).toBe(1);
    await expect(svc.linkedinProfile(free, { cv: sampleCV })).rejects.toBeInstanceOf(CreditsExhaustedError);
  });
});
