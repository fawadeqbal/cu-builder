import { OfflineAssistant } from "@cvb/ai";
import { CreditsExhaustedError } from "@cvb/shared";
import { describe, expect, it } from "vitest";
import type { AuthUser } from "../../common/auth/auth.types.js";
import type { CreditsRepository } from "./credits.repository.js";
import { CreditsService } from "./credits.service.js";

class MemoryCredits implements CreditsRepository {
  rows: { delta: number; reason: string }[] = [];
  async usage() {
    const sum = (f: (r: { delta: number; reason: string }) => boolean) => this.rows.filter(f).reduce((n, r) => n + r.delta, 0);
    return {
      usedThisMonth: -sum((r) => r.reason.endsWith(":allowance")),
      purchased: sum((r) => r.delta > 0),
      purchasedUsed: -sum((r) => r.reason.endsWith(":purchased")),
    };
  }
  async spend({ amount, task, pool }: { amount: number; task: string; pool: string }) {
    this.rows.push({ delta: -amount, reason: `ai:${task}:${pool}` });
  }
}

const free: AuthUser = { id: "u", email: "u@x.com", name: "U", role: "user", emailVerified: true, plan: "free", planSource: "base" };

describe("CreditsService", () => {
  it("charges successful calls and stops at the allowance", async () => {
    const repo = new MemoryCredits();
    const svc = new CreditsService(repo, new OfflineAssistant());
    for (let i = 0; i < 3; i++) await svc.charge(free, "rewrite", async () => ({ ok: true }));
    await expect(svc.charge(free, "rewrite", async () => ({ ok: true }))).rejects.toBeInstanceOf(CreditsExhaustedError);
    expect((await svc.balance(free)).remaining).toBe(0);
  });

  it("does not charge when the work fails", async () => {
    const repo = new MemoryCredits();
    const svc = new CreditsService(repo, new OfflineAssistant());
    await expect(svc.charge(free, "rewrite", async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    expect(repo.rows).toHaveLength(0);
  });

  it("uses purchased credits after the allowance", async () => {
    const repo = new MemoryCredits();
    repo.rows.push({ delta: 10, reason: "purchase:x" });
    const svc = new CreditsService(repo, new OfflineAssistant());
    const out = await svc.charge(free, "tailor", async () => ({}));
    expect(out.credits.remaining).toBe(10);
    await svc.charge(free, "tailor", async () => ({}));
    expect(repo.rows.at(-1)?.reason).toBe("ai:tailor:purchased");
    expect((await svc.balance(free)).remaining).toBe(7);
  });
});
