import { describe, expect, it } from "vitest";
import { applyOverrides, TEMPLATES } from "./catalog";

describe("applyOverrides", () => {
  it("returns the catalog unchanged without overrides", () => {
    expect(applyOverrides(TEMPLATES, [])).toEqual(TEMPLATES);
  });

  it("hides, re-tiers and reorders templates", () => {
    const out = applyOverrides(TEMPLATES, [
      { templateId: "simple", enabled: false, tier: null, sortOrder: null },
      { templateId: "boardroom", enabled: true, tier: "standard", sortOrder: 1 },
    ]);
    expect(out.find((t) => t.id === "simple")).toBeUndefined();
    expect(out[0]).toMatchObject({ id: "boardroom", tier: "standard" });
    expect(out).toHaveLength(TEMPLATES.length - 1);
  });
});
