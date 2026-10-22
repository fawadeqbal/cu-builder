import { describe, expect, it } from "vitest";
import { QUESTION_BANK, questionsFor, roleFamily, sessionSummary } from "./index";

describe("question bank", () => {
  it("has unique ids and an answer outline for every question", () => {
    expect(new Set(QUESTION_BANK.map((q) => q.id)).size).toBe(QUESTION_BANK.length);
    expect(QUESTION_BANK.every((q) => q.answer.length > 20)).toBe(true);
  });

  it("filters by family and seniority, always including general questions", () => {
    const entry = questionsFor({ family: "software", seniority: "entry" });
    expect(entry.some((q) => q.family === "general")).toBe(true);
    expect(entry.some((q) => q.id === "s6")).toBe(false);
    expect(questionsFor({ family: "software", seniority: "senior" }).some((q) => q.id === "s6")).toBe(true);
  });

  it("guesses the role family", () => {
    expect(roleFamily("Senior Backend Developer")).toBe("software");
    expect(roleFamily("Account Executive")).toBe("sales");
    expect(roleFamily("Office Manager")).toBe("general");
  });

  it("averages answer scores", () => {
    expect(sessionSummary([{ scores: { structure: 4, relevance: 5, clarity: 3 } }, { scores: { structure: 2, relevance: 3, clarity: 5 } }])).toEqual({
      structure: 3,
      relevance: 4,
      clarity: 4,
      overall: 3.7,
      answered: 2,
    });
  });
});
