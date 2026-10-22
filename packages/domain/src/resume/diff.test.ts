import { describe, expect, it } from "vitest";
import { applyChanges, diffCV } from "./diff";
import { sampleCV } from "./sample";

describe("diffCV / applyChanges", () => {
  const next = structuredClone(sampleCV);
  next.summary = "A new summary.";
  next.personal.headline = "Senior Engineer";
  next.experience[0]!.bullets = ["Led the platform rewrite"];
  next.skills.push({ id: "new-group", category: "Cloud", items: "AWS, Kubernetes" });

  it("lists each changed field once", () => {
    const changes = diffCV(sampleCV, next);
    expect(changes.map((c) => c.id)).toEqual(
      expect.arrayContaining(["summary", "personal.headline", `experience.${sampleCV.experience[0]!.id}.bullets`, "skills.new-group.new"]),
    );
    expect(changes).toHaveLength(4);
  });

  it("applies only accepted changes and leaves the base untouched", () => {
    const changes = diffCV(sampleCV, next);
    const out = applyChanges(sampleCV, next, changes, new Set(["summary", "skills.new-group.new"]));
    expect(out.summary).toBe("A new summary.");
    expect(out.personal.headline).toBe(sampleCV.personal.headline);
    expect(out.skills.at(-1)?.category).toBe("Cloud");
    expect(sampleCV.summary).not.toBe("A new summary.");
  });

  it("returns no changes for identical CVs", () => {
    expect(diffCV(sampleCV, structuredClone(sampleCV))).toEqual([]);
  });
});
