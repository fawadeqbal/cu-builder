import { describe, expect, it } from "vitest";
import { clean, emptyCV, linkHref, linkLabel, normalizeCV } from "./model";
import { cvChecks, cvStrength, stepState } from "./quality";

describe("normalizeCV", () => {
  it("fills gaps and drops junk", () => {
    const cv = normalizeCV({ personal: { name: "Sara", bogus: 1 }, experience: [{ role: "Dev", bullets: ["a", 2] }, 5] });
    expect(cv.personal.name).toBe("Sara");
    expect(cv.personal.email).toBe("");
    expect(cv.experience).toHaveLength(1);
    expect(cv.experience[0]?.bullets).toEqual(["a"]);
    expect(cv.experience[0]?.id).toMatch(/^exp-/);
    expect(cv.skills).toEqual([]);
  });

  it("accepts garbage", () => {
    expect(normalizeCV(null)).toEqual(emptyCV);
  });
});

describe("links", () => {
  it("adds a protocol and strips it for display", () => {
    expect(linkHref("github.com/me")).toBe("https://github.com/me");
    expect(linkHref("mailto:a@b.c")).toBe("mailto:a@b.c");
    expect(linkLabel("https://me.dev/")).toBe("me.dev");
    expect(clean([" a ", "", "b"])).toEqual(["a", "b"]);
  });
});

describe("quality", () => {
  it("scores an empty CV at zero-ish and tracks steps", () => {
    expect(cvStrength(emptyCV)).toBeLessThan(0.5);
    expect(cvChecks(emptyCV).every((c) => typeof c.ok === "boolean")).toBe(true);
    expect(stepState(emptyCV, "personal")).toEqual({ done: false, meta: "Required" });
    expect(stepState(emptyCV, "projects").meta).toBe("Optional");
  });
});
