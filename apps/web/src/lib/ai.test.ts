import { describe, expect, it } from "vitest";
import { aiTaskOf } from "./ai";

describe("aiTaskOf", () => {
  it("names the AI task behind an endpoint, for analytics", () => {
    expect(aiTaskOf("/ai/improve-bullet")).toBe("improve-bullet");
    expect(aiTaskOf("/jobs/abc123/tailor")).toBe("tailor");
    expect(aiTaskOf("/cover-letters/draft")).toBe("cover-letter");
    expect(aiTaskOf("/interviews/sessions")).toBe("interview-questions");
    expect(aiTaskOf("/interviews/sessions/s1/answer")).toBe("interview-feedback");
    expect(aiTaskOf("/applications/a1/brief")).toBe("company-brief");
    expect(aiTaskOf("/resumes")).toBeNull();
  });
});
