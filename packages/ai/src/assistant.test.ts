import { sampleCV } from "@cvb/domain";
import { describe, expect, it } from "vitest";
import { LlmAssistant } from "./llm-assistant";
import { OfflineAssistant } from "./offline";
import type { TextModel } from "./types";

/** A TextModel that replays scripted replies and records prompts. */
function scripted(replies: string[]): TextModel & { prompts: string[] } {
  const prompts: string[] = [];
  return {
    prompts,
    async complete({ messages }) {
      prompts.push(messages.at(-1)!.content);
      return replies.shift() ?? "";
    },
  };
}

describe("LlmAssistant", () => {
  it("returns three bullet options with invented numbers replaced", async () => {
    const model = scripted([JSON.stringify({ options: ["Built a dashboard for 120 clinics", "1. Cut load time by 60%", "Led the rebuild"] })]);
    const out = await new LlmAssistant(model).improveBullet({ bullet: "made a dashboard for 120 clinics", role: "Developer" });
    expect(out.options).toEqual(["Built a dashboard for 120 clinics", "Cut load time by [number]", "Led the rebuild"]);
  });

  it("retries once when the reply isn't valid JSON", async () => {
    const model = scripted(["sorry, here you go", '{"text": "Fixed text."}']);
    const out = await new LlmAssistant(model).rewrite({ text: "fixd text", mode: "grammar" });
    expect(out.text).toBe("Fixed text.");
    expect(model.prompts).toHaveLength(2);
  });

  it("fails cleanly after two bad replies", async () => {
    const model = scripted(["nope", "still nope"]);
    await expect(new LlmAssistant(model).rewrite({ text: "x", mode: "grammar" })).rejects.toThrow(/couldn't be used/);
  });

  it("tailors only known entries and guards numbers", async () => {
    const id = sampleCV.experience[0]!.id;
    const model = scripted([
      JSON.stringify({
        headline: "Senior Full Stack Engineer",
        experience: [{ id, bullets: ["Scaled the API to 9999 requests per second"] }, { id: "unknown", bullets: ["x"] }],
        skills: [{ id: null, category: "Cloud", items: "AWS" }],
        notes: ["Add Kubernetes if you have used it"],
      }),
    ]);
    const out = await new LlmAssistant(model).tailor({ cv: sampleCV, job: { title: "Engineer", company: "Acme", description: "React" }, missing: [] });
    expect(out.cv.personal.headline).toBe("Senior Full Stack Engineer");
    expect(out.cv.experience[0]!.bullets).toEqual(["Scaled the API to [number] requests per second"]);
    expect(out.cv.skills.at(-1)?.category).toBe("Cloud");
    expect(out.notes).toHaveLength(1);
    expect(sampleCV.personal.headline).not.toBe("Senior Full Stack Engineer");
  });
});

describe("OfflineAssistant", () => {
  const ai = new OfflineAssistant();
  it("turns a duty into achievement options without inventing numbers", async () => {
    const out = await ai.improveBullet({ bullet: "Responsible for the booking website" });
    expect(out.options).toHaveLength(3);
    expect(out.options[0]).toMatch(/^Led the booking website/);
    expect(out.options.join(" ")).not.toMatch(/\d/);
  });

  it("writes summaries and letters from the CV", async () => {
    expect((await ai.writeSummary({ cv: sampleCV })).options).toHaveLength(2);
    const letter = await ai.coverLetter({ cv: sampleCV, job: { title: "Engineer", company: "Acme", description: "" }, tone: "formal", length: "medium" });
    expect(letter.paragraphs.join(" ")).toContain("Acme");
  });

  it("scores interview answers", async () => {
    const f = await ai.interviewFeedback({ role: "Developer", question: "Q", answer: "I built a tool that reduced support tickets by 30% over three months for our team of five people." });
    expect(f.scores.structure).toBeGreaterThanOrEqual(3);
  });
});
