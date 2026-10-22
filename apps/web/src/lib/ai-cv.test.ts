import { applyChanges, diffCV, emptyCV } from "@cvb/domain";
import { describe, expect, it } from "vitest";
import { assembleCv, blankEducation, blankJob, blankProject, countPlaceholders, notesToLines, parseLanguages, regroupSkills, skillsChange, validateDraft, type CvDraft } from "./ai-cv";

const draft = (over: Partial<CvDraft> = {}): CvDraft => ({
  name: "Ayesha Khan",
  title: "Frontend Developer",
  email: "",
  phone: "",
  location: "",
  link: "",
  level: "mid",
  jobs: [],
  projects: [],
  education: [],
  skills: "",
  languages: "",
  ...over,
});

describe("ai-cv helpers", () => {
  it("parses languages typed as free text", () => {
    expect(parseLanguages("English – fluent, Urdu - native; Arabic (basic)\nPunjabi").map(({ name, level }) => [name, level])).toEqual([
      ["English", "Fluent"],
      ["Urdu", "Native"],
      ["Arabic", "Basic"],
      ["Punjabi", ""],
    ]);
  });

  it("turns rough notes into lines without inventing anything", () => {
    expect(notesToLines("- built the checkout\n• fixed bugs\n\n2) led 3 interns")).toEqual(["Built the checkout", "Fixed bugs", "Led 3 interns"]);
  });

  it("reuses skill group ids in order and keeps items within the schema", () => {
    const base = [{ id: "s1", category: "Tech", items: "React" }];
    const out = regroupSkills(base, [
      { category: "Frontend", items: "React, CSS" },
      { category: "Tools", items: "Git" },
      { category: "Empty", items: " " },
    ]);
    expect(out.map((g) => [g.id === "s1", g.category, g.items])).toEqual([
      [true, "Frontend", "React, CSS"],
      [false, "Tools", "Git"],
    ]);
    const long = regroupSkills([], [{ category: "Many", items: Array.from({ length: 200 }, (_, i) => `skill${i}`).join(", ") }]);
    expect(long.length).toBeGreaterThan(1);
    expect(long.every((g) => g.items.length <= 600)).toBe(true);
  });

  it("reviews regrouped skills as one change and applies it alongside diffCV", () => {
    const base = { ...emptyCV, skills: [{ id: "a", category: "", items: "React, Git" }, { id: "b", category: "Soft", items: "Teamwork" }] };
    const nextSkills = regroupSkills(base.skills, [{ category: "Frontend", items: "React" }]);
    const change = skillsChange(base.skills, nextSkills)!;
    expect(change.before).toEqual(["React, Git", "Soft: Teamwork"]);
    expect(change.after).toEqual(["Frontend: React"]);
    const next = { ...base, summary: "New [number] summary" };
    const changes = diffCV(base, next);
    expect(countPlaceholders(changes.map((c) => c.after))).toBe(1);
    // applyChanges leaves the synthetic change alone; the caller applies the skills.
    expect(applyChanges(base, next, [...changes, change], new Set(["summary", change.id])).skills).toEqual(base.skills);
  });

  it("validates the required fields and the rows that were started", () => {
    const job = { ...blankJob(), company: "NextByte" };
    const errors = validateDraft(draft({ name: " ", title: "", email: "nope", jobs: [job, blankJob()] }));
    expect(Object.keys(errors).sort()).toEqual(["email", `job-${job.key}-role`, "name", "title"].sort());
  });

  it("assembles a CV from the form, using notes where the AI didn't write", () => {
    const j1 = { ...blankJob(), role: "Developer", company: "NextByte", notes: "built the site\nmentored juniors" };
    const j2 = { ...blankJob(), role: "Intern", company: "Acme", notes: "made coffee" };
    const p = { ...blankProject(), name: "Portfolio", link: "github.com/me", notes: "my site" };
    const cv = assembleCv(
      draft({ link: "linkedin.com/in/ayesha", jobs: [j1, j2, blankJob()], projects: [p], education: [{ ...blankEducation(), degree: "BSc CS" }], skills: "React, Node.js", languages: "English – fluent" }),
      { bullets: { [j1.key]: ["Built the company site used by [number] customers"] }, skills: null, summary: "Frontend developer." },
    );
    expect(cv.personal).toMatchObject({ name: "Ayesha Khan", headline: "Frontend Developer", linkedin: "linkedin.com/in/ayesha", website: "" });
    expect(cv.experience.map((e) => e.bullets)).toEqual([["Built the company site used by [number] customers"], ["Made coffee"]]);
    expect(cv.projects[0]).toMatchObject({ name: "Portfolio", links: ["github.com/me"], bullets: ["My site"] });
    expect(cv.skills.map((s) => s.items)).toEqual(["React, Node.js"]);
    expect(cv.languages.map((l) => l.name)).toEqual(["English"]);
    expect(cv.summary).toBe("Frontend developer.");
    expect(cv.education[0]?.degree).toBe("BSc CS");
  });
});
