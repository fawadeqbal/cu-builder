import { OfflineAssistant } from "@cvb/ai";
import type { DbClient } from "@cvb/db";
import { PlanRequiredError } from "@cvb/shared";
import { describe, expect, it } from "vitest";
import type { AuthUser } from "../../common/auth/auth.types.js";
import type { AiService } from "../ai/ai.service.js";
import type { CreditsService } from "../ai/credits.service.js";
import { InterviewsService } from "./interviews.service.js";

const user = (plan: AuthUser["plan"]): AuthUser => ({ id: "u1", email: "u1@example.com", name: "U", role: "user", emailVerified: true, plan, planSource: "base" });

/** Just enough of Prisma for the session use cases. */
function fakeDb() {
  const sessions: Record<string, unknown>[] = [];
  const db = {
    job: { findFirst: async () => null },
    interviewSession: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `s${sessions.length + 1}`, answers: [], completedAt: null, createdAt: new Date("2026-10-22T10:00:00Z"), ...data };
        sessions.push(row);
        return row;
      },
      findFirst: async ({ where }: { where: { id: string } }) => sessions.find((s) => s.id === where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => Object.assign(sessions.find((s) => s.id === where.id)!, data),
    },
  };
  return db as unknown as DbClient;
}

const credits = { charge: async (_u: unknown, _t: unknown, work: () => Promise<object>) => ({ ...(await work()), credits: { remaining: 9 } }) } as unknown as CreditsService;
const ai = { call: (_l: string, fn: () => Promise<unknown>) => fn() } as unknown as AiService;

describe("InterviewsService", () => {
  it("serves the question bank for the role's family", () => {
    const service = new InterviewsService(fakeDb(), new OfflineAssistant(), credits, ai);
    const bank = service.bank({ role: "Senior React Developer", seniority: "entry" });
    expect(bank.family).toBe("software");
    expect(bank.questions.every((q) => q.family === "software" || q.family === "general")).toBe(true);
    expect(bank.questions.some((q) => q.from === "senior")).toBe(false);
  });

  it("keeps mock interviews for Premium", async () => {
    const service = new InterviewsService(fakeDb(), new OfflineAssistant(), credits, ai);
    await expect(service.start(user("standard"), { role: "Engineer", seniority: "mid", count: 3 })).rejects.toBeInstanceOf(PlanRequiredError);
  });

  it("asks one follow-up when an answer has no result", async () => {
    const service = new InterviewsService(fakeDb(), new OfflineAssistant(), credits, ai);
    const { session } = await service.start(user("premium"), { role: "Engineer", seniority: "mid", count: 3 });
    const out = await service.answer(user("premium"), session.id, { index: 0, answer: "We worked on the platform together." });
    expect(out.session.questions).toHaveLength(4);
    expect(out.session.questions[3]!.competency).toBe("Follow-up");
    const again = await service.answer(user("premium"), session.id, { index: 3, answer: "We worked on it." });
    expect(again.session.questions).toHaveLength(4);
  });

  it("scores answers and completes the session when all are answered", async () => {
    const service = new InterviewsService(fakeDb(), new OfflineAssistant(), credits, ai);
    const { session } = await service.start(user("premium"), { role: "Engineer", seniority: "mid", count: 3 });
    expect(session.questions).toHaveLength(3);
    for (const index of [0, 1, 2]) {
      const out = await service.answer(user("premium"), session.id, { index, answer: "I built a reporting tool which reduced manual work by 40%." });
      expect(out.answer.scores.structure).toBeGreaterThan(2);
      expect(out.session.completedAt === null).toBe(index < 2);
    }
  });
});
