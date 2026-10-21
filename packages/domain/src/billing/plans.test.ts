import { describe, expect, it } from "vitest";
import { FEATURES, PLANS, can, canUseTemplateTier, requiredPlanFor } from "./plans";

describe("plans", () => {
  it("never takes a feature away from a higher plan", () => {
    for (const feature of FEATURES) {
      let unlocked = false;
      for (const plan of PLANS) {
        if (unlocked) expect(can(plan, feature)).toBe(true);
        unlocked ||= can(plan, feature);
      }
      expect(unlocked).toBe(true);
    }
  });

  it("gates AI tailoring to Premium", () => {
    expect(can("standard", "ai.tailor")).toBe(false);
    expect(can("premium", "ai.tailor")).toBe(true);
    expect(requiredPlanFor("ai.tailor")).toBe("premium");
  });

  it("opens template tiers by plan", () => {
    expect(canUseTemplateTier("free", "basic")).toBe(true);
    expect(canUseTemplateTier("free", "standard")).toBe(false);
    expect(canUseTemplateTier("premium", "executive")).toBe(true);
  });
});
