import { atsReport, normalizeCV } from "@cvb/domain";
import { templateMeta } from "@cvb/templates/catalog";
import { describe, expect, it } from "vitest";
import { EXAMPLE_CATEGORIES, EXAMPLES, exampleBySlug, relatedExamples } from "./index";

describe("CV examples", () => {
  it("has about two dozen examples with unique, URL-safe slugs", () => {
    expect(EXAMPLES.length).toBe(24);
    const slugs = EXAMPLES.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(exampleBySlug("nurse")?.role).toBe("Nurse");
    expect(exampleBySlug("nope")).toBeUndefined();
  });

  it.each(EXAMPLES.map((e) => [e.slug, e] as const))("%s is complete and honest", (_, e) => {
    expect(EXAMPLE_CATEGORIES).toContain(e.category);
    expect(e.tips.length).toBeGreaterThanOrEqual(4);
    expect(e.tips.length).toBeLessThanOrEqual(6);
    expect(e.faqs.length).toBeGreaterThanOrEqual(2);
    expect(e.faqs.length).toBeLessThanOrEqual(3);
    expect(e.skills.length).toBeGreaterThanOrEqual(8);
    expect(e.skills.length).toBeLessThanOrEqual(12);
    expect(e.description.length).toBeGreaterThan(80);
    expect(e.description.length).toBeLessThanOrEqual(170);
    expect(e.sampleSummary.text.split(/\s+/).length).toBeGreaterThan(20);
    // Guests can use and download it: a free (basic-tier) template.
    expect(templateMeta(e.template).tier).toBe("basic");
    // Made-up contact details only.
    expect(e.cv.personal.email).toMatch(/@example\.com$/);
    for (const link of [e.cv.personal.website, e.cv.personal.linkedin, e.cv.personal.github]) if (link) expect(link).toMatch(/example\.com/);
    // Survives the same normalisation the builder applies when loading it.
    expect(normalizeCV(e.cv)).toEqual(e.cv);
  });

  it.each(EXAMPLES.map((e) => [e.slug, e] as const))("%s scores well on the ATS check", (_, e) => {
    const report = atsReport(e.cv, { templateAts: templateMeta(e.template).ats });
    expect(report.score, report.issues.map((i) => i.message).join("; ")).toBeGreaterThanOrEqual(80);
    expect(report.issues.filter((i) => i.severity === "high")).toEqual([]);
  });

  it("suggests related examples from the same category first", () => {
    const nurse = exampleBySlug("nurse")!;
    const related = relatedExamples(nurse);
    expect(related).toHaveLength(3);
    expect(related.map((r) => r.slug)).not.toContain("nurse");
    expect(related[0]?.category).toBe("Healthcare");
  });
});
