import { describe, expect, it } from "vitest";
import { CreateResumeSchema, ResumeDataSchema, UpdateResumeSchema } from "./resume";
import { EmailJobSchema } from "./jobs";

describe("resume contracts", () => {
  it("fills defaults for a new resume", () => {
    const dto = CreateResumeSchema.parse({});
    expect(dto).toMatchObject({ title: "Untitled CV", templateId: "classic", accent: null, pageSize: "A4" });
  });

  it("rejects an empty update and bad colours", () => {
    expect(UpdateResumeSchema.safeParse({}).success).toBe(false);
    expect(UpdateResumeSchema.safeParse({ accent: "red" }).success).toBe(false);
    expect(UpdateResumeSchema.safeParse({ accent: "#1e4b8f" }).success).toBe(true);
  });

  it("parses a minimal CV document", () => {
    const cv = ResumeDataSchema.parse({ personal: {} });
    expect(cv.personal.name).toBe("");
    expect(cv.experience).toEqual([]);
  });

  it("validates job payloads", () => {
    expect(EmailJobSchema.safeParse({ template: "welcome", to: "a@b.co", name: "A" }).success).toBe(true);
    expect(EmailJobSchema.safeParse({ template: "welcome", to: "nope", name: "A" }).success).toBe(false);
  });
});
