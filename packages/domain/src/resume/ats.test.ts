import { describe, expect, it } from "vitest";
import { atsReport, dateStyle, isActionLed, isQuantified } from "./ats";
import { emptyCV } from "./model";
import { sampleCV } from "./sample";

describe("atsReport", () => {
  it("scores the example CV well on an ATS template", () => {
    const r = atsReport(sampleCV, { templateAts: true, pages: 1 });
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.sections.map((s) => s.id)).toEqual(["parsing", "completeness", "impact", "length", "readability", "consistency"]);
    expect(r.sections.reduce((n, s) => n + s.max, 0)).toBe(100);
  });

  it("scores an empty CV low and points at the steps to fix", () => {
    const r = atsReport(emptyCV, { templateAts: true });
    expect(r.score).toBeLessThan(40);
    expect(r.grade).toBe("weak");
    const steps = new Set(r.issues.map((i) => i.step));
    expect(steps.has("personal")).toBe(true);
    expect(steps.has("experience")).toBe(true);
    expect(r.issues.every((i) => i.message && i.fix)).toBe(true);
  });

  it("penalises column templates and weak, unquantified lines", () => {
    const cv = {
      ...sampleCV,
      experience: [{ ...sampleCV.experience[0]!, bullets: ["Responsible for the website", "Worked on bugs"] }],
    };
    const r = atsReport(cv, { templateAts: false });
    expect(r.issues.some((i) => i.section === "parsing")).toBe(true);
    expect(r.issues.some((i) => i.section === "impact" && i.itemId === cv.experience[0]!.id)).toBe(true);
    expect(r.score).toBeLessThan(atsReport(sampleCV, { templateAts: true }).score);
  });

  it("orders issues by severity", () => {
    const order = { high: 0, medium: 1, low: 2 };
    const sev = atsReport(emptyCV, { templateAts: false }).issues.map((i) => order[i.severity]);
    expect(sev).toEqual([...sev].sort((a, b) => a - b));
  });
});

describe("helpers", () => {
  it("detects action verbs, numbers and date styles", () => {
    expect(isActionLed("Built a booking platform")).toBe(true);
    expect(isActionLed("Responsible for builds")).toBe(false);
    expect(isQuantified("Cut load time by 40%")).toBe(true);
    expect(isQuantified("Improved the UI")).toBe(false);
    expect(dateStyle("Mar 2024 – Present")).toBe("month-name");
    expect(dateStyle("03/2024 - 05/2025")).toBe("numeric");
    expect(dateStyle("2018 – 2022")).toBe("year");
    expect(dateStyle("")).toBe("none");
  });
});
