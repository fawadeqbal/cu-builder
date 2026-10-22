import { LINKEDIN_LIMITS, sampleCV } from "@cvb/domain";
import { describe, expect, it } from "vitest";
import { draftLinkedInProfile } from "./linkedin";
import { LlmAssistant } from "./llm-assistant";
import { OfflineAssistant } from "./offline";
import type { TextModel } from "./types";

const reply = (body: unknown): TextModel => ({ complete: async () => JSON.stringify(body) });

describe("LinkedIn profile", () => {
  it("offline: builds every part from the CV, within LinkedIn's limits", async () => {
    const p = await new OfflineAssistant().linkedinProfile({ cv: sampleCV });
    expect(p.headline).toBe("Full Stack Developer at Bright Labs | React, Next.js, TypeScript");
    expect(p.headlineOptions).toHaveLength(3);
    expect(new Set(p.headlineOptions).size).toBe(3);
    expect(p.about.split("\n\n")).toHaveLength(3);
    expect(p.about).toMatch(/^I'm a Full Stack Developer at Bright Labs\./);
    expect(p.about).toContain("[the kind of role");
    expect(p.experience.map((e) => e.id)).toEqual(["exp-1", "exp-2"]);
    expect(p.experience[0]!.description.split("\n")[0]).toMatch(/^• Build and maintain/);
    expect(p.experience[0]!.description).toContain("Tools: Next.js");
    expect(p.skills).toEqual(["React", "Next.js", "TypeScript", "Tailwind CSS", "TanStack Query"]);
    expect(p.headline.length).toBeLessThanOrEqual(LINKEDIN_LIMITS.headline);
    expect(p.about.length).toBeLessThanOrEqual(LINKEDIN_LIMITS.about);
  });

  it("offline: copes with an almost empty CV", () => {
    const p = draftLinkedInProfile({ ...sampleCV, personal: { ...sampleCV.personal, headline: "" }, experience: [], projects: [], skills: [], summary: "" });
    expect(p.headline).toBe("Professional");
    expect(p.experience).toEqual([]);
    expect(p.skills).toEqual([]);
    expect(p.about).toContain("I'm a Professional.");
  });

  it("llm: keeps CV facts only, guards numbers, fits limits and fills gaps", async () => {
    const model = reply({
      headline: "Full Stack Developer | React · Node.js · PostgreSQL",
      headlineOptions: ["Full Stack Developer | React, Node.js", "Full Stack Developer | React, Node.js", "Builder of tools used by 500 clinics"],
      about: ["I build web apps with React and Node.js.", "At Bright Labs I serve 120+ clinics and cut a report from 4 s to 300 ms, saving 90% of time.", "x".repeat(3000)],
      experience: [{ id: "exp-1", description: "I build the booking platform.\n• Cut the slowest query from 4 s to 300 ms" }, { id: "ghost", description: "Invented job" }],
      skills: ["React", "Kubernetes", "postgresql", "Node.js"],
    });
    const p = await new LlmAssistant(model).linkedinProfile({ cv: sampleCV });
    expect(p.headline).toBe("Full Stack Developer | React · Node.js · PostgreSQL");
    // Duplicates dropped; the invented number replaced; filled up to three from the draft.
    expect(p.headlineOptions).toHaveLength(3);
    expect(p.headlineOptions).toContain("Builder of tools used by [number] clinics");
    expect(p.about).toContain("120+ clinics");
    expect(p.about).toContain("saving [number] of time.");
    expect(p.about.length).toBeLessThanOrEqual(LINKEDIN_LIMITS.about);
    // One description per CV job, in CV order; the made-up job is ignored; a missing one uses the CV's lines.
    expect(p.experience.map((e) => [e.id, e.company])).toEqual([
      ["exp-1", "Bright Labs"],
      ["exp-2", "Pixel Works"],
    ]);
    expect(p.experience[0]!.description).toContain("4 s to 300 ms");
    expect(p.experience[1]!.description).toMatch(/^• Turned Figma designs/);
    // Skills not on the CV are dropped; spelling follows the CV; topped up to five.
    expect(p.skills).toEqual(["React", "PostgreSQL", "Node.js", "Next.js", "TypeScript"]);
  });
});
