import { describe, expect, it } from "vitest";
import { emptyCV } from "./model";
import { sampleCV } from "./sample";
import { cvToText } from "./text";

describe("cvToText", () => {
  it("writes headings, bullets and contact details", () => {
    const text = cvToText(sampleCV);
    expect(text.startsWith(sampleCV.personal.name)).toBe(true);
    expect(text).toContain("\nEXPERIENCE\n");
    expect(text).toContain(`- ${sampleCV.experience[0]!.bullets[0]}`);
    expect(text).not.toContain("\t");
  });

  it("leaves out empty sections", () => {
    const text = cvToText({ ...emptyCV, personal: { ...emptyCV.personal, name: "Ada" } });
    expect(text).toBe("Ada\n");
  });
});
