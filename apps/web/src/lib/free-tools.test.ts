import { describe, expect, it } from "vitest";
import { EMPTY_SUMMARY_FIELDS, summaryToolCv } from "./free-tools";

describe("summary tool CV", () => {
  it("only contains what the person typed", () => {
    const cv = summaryToolCv({
      ...EMPTY_SUMMARY_FIELDS,
      targetTitle: "Data Analyst",
      role: "Junior Analyst",
      company: "Cedar Mart",
      years: "3",
      skills: "SQL, Power BI",
      highlights: "- Built a weekly sales dashboard\n\n• Automated stock reports",
    });
    expect(cv.personal.headline).toBe("Data Analyst");
    expect(cv.summary).toBe("3 years of experience as Junior Analyst.");
    expect(cv.experience).toEqual([expect.objectContaining({ role: "Junior Analyst", company: "Cedar Mart", bullets: ["Built a weekly sales dashboard", "Automated stock reports"] })]);
    expect(cv.skills).toEqual([expect.objectContaining({ items: "SQL, Power BI" })]);
    expect(cv.education).toEqual([]);
  });

  it("leaves out empty parts", () => {
    const cv = summaryToolCv({ ...EMPTY_SUMMARY_FIELDS, targetTitle: "Teacher" });
    expect(cv.summary).toBe("");
    expect(cv.experience).toEqual([]);
    expect(cv.skills).toEqual([]);
  });
});
