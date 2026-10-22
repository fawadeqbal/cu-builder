import { describe, expect, it } from "vitest";
import { charCount, linkedinParts } from "./linkedin";

describe("LinkedIn profile parts", () => {
  const parts = linkedinParts({
    headline: "Full Stack Developer | React",
    headlineOptions: ["A", "B"],
    about: "I build things.",
    experience: [
      { id: "exp-1", role: "Developer", company: "Bright Labs", description: "• Built it" },
      { id: "exp-2", role: "", company: "", description: "" },
    ],
    skills: ["React", "Node.js"],
  });

  it("lists every part with LinkedIn's limits", () => {
    expect(parts.main.map((p) => [p.label, p.max])).toEqual([
      ["Headline", 220],
      ["About", 2600],
    ]);
    expect(parts.headlines.map((p) => p.label)).toEqual(["Option 1", "Option 2"]);
    expect(parts.experience.map((p) => p.label)).toEqual(["Developer · Bright Labs", "Job"]);
    expect(parts.skills.text).toBe("React, Node.js");
  });

  it("counts characters against the limit", () => {
    expect(charCount("abc", 220)).toEqual({ label: "3 / 220", over: false });
    expect(charCount("x".repeat(221), 220).over).toBe(true);
    expect(charCount("abc", null)).toEqual({ label: "3 characters", over: false });
  });
});
