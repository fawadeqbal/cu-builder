import { describe, expect, it } from "vitest";
import { markReviewPromptSeen, REVIEW_PROMPT_KEY, reviewPromptSeen } from "./review-prompt";

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

describe("review prompt memory", () => {
  it("asks until the prompt has been shown once", () => {
    const s = memory();
    expect(reviewPromptSeen(s)).toBe(false);
    markReviewPromptSeen("shown", s);
    expect(reviewPromptSeen(s)).toBe(true);
    expect(s.m.get(REVIEW_PROMPT_KEY)).toBe("shown");
  });

  it("treats blocked storage as already asked", () => {
    expect(reviewPromptSeen(null)).toBe(true);
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(reviewPromptSeen(broken)).toBe(true);
    expect(() => markReviewPromptSeen("dismissed", broken)).not.toThrow();
  });
});
