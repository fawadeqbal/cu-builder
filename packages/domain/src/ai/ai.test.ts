import { describe, expect, it } from "vitest";
import { cleanLine, creditBalance, guardNumbers, hasPlaceholders } from "./index";

describe("guardNumbers", () => {
  it("keeps numbers from the source and replaces invented ones", () => {
    const out = guardNumbers("Cut load time by 40% for 120 clinics, saving $50k", "Made the site faster for 120 clinics");
    expect(out).toBe("Cut load time by [number] for 120 clinics, saving [number]");
    expect(hasPlaceholders(out)).toBe(true);
  });

  it("leaves text without numbers alone", () => {
    expect(guardNumbers("Led the redesign", "redesign")).toBe("Led the redesign");
  });
});

describe("credits", () => {
  it("spends the monthly allowance before purchased credits", () => {
    expect(creditBalance({ plan: "free", usedThisMonth: 1, purchased: 0, purchasedUsed: 0 }).remaining).toBe(2);
    expect(creditBalance({ plan: "free", usedThisMonth: 5, purchased: 10, purchasedUsed: 2 }).remaining).toBe(8);
  });
});

describe("cleanLine", () => {
  it("strips bullets, numbering and quotes", () => {
    expect(cleanLine('1. "Built a dashboard"')).toBe("Built a dashboard");
    expect(cleanLine("- Option 2: Led a team")).toBe("Led a team");
  });
});
