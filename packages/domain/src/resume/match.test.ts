import { describe, expect, it } from "vitest";
import { addKeyword, detectSeniority, experienceYears, matchJob, requiredYears } from "./match";
import { sampleCV } from "./sample";

const JOB = `Senior Full Stack Engineer
We are looking for an engineer with 4+ years of experience.
Requirements:
- Strong React and TypeScript
- Node.js and PostgreSQL
- Docker and AWS
Nice to have:
- Kubernetes
- GraphQL`;

describe("matchJob", () => {
  it("finds required and nice-to-have keywords and what's missing", () => {
    const m = matchJob(sampleCV, { title: "Senior Full Stack Engineer", description: JOB }, new Date("2026-10-01"));
    const req = m.keywords.filter((k) => k.required).map((k) => k.keyword);
    const nice = m.keywords.filter((k) => !k.required).map((k) => k.keyword);
    expect(req).toEqual(expect.arrayContaining(["react", "typescript", "node.js", "postgresql", "docker", "aws"]));
    expect(nice).toEqual(expect.arrayContaining(["kubernetes", "graphql"]));
    expect(m.found).toEqual(expect.arrayContaining(["react", "node.js", "postgresql"]));
    expect(m.score).toBeGreaterThan(0);
    expect(m.score).toBeLessThanOrEqual(100);
    expect(m.seniority.jobYears).toBe(4);
  });

  it("scores a CV with every keyword higher than one without", () => {
    const empty = { ...sampleCV, summary: "", skills: [], experience: [], projects: [] };
    const full = matchJob(sampleCV, { description: JOB });
    const none = matchJob(empty, { description: JOB });
    expect(full.score).toBeGreaterThan(none.score);
  });

  it("adds a missing keyword to a skills group", () => {
    const next = addKeyword(sampleCV, "kubernetes", () => "new");
    expect(matchJob(next, { description: JOB }).found).toContain("kubernetes");
  });
});

describe("seniority and years", () => {
  it("reads seniority and required years", () => {
    expect(detectSeniority("Senior Backend Developer")).toBe("senior");
    expect(detectSeniority("Graduate trainee")).toBe("junior");
    expect(requiredYears("at least 3+ years in sales")).toBe(3);
    expect(requiredYears("no requirement")).toBeNull();
  });

  it("counts overlapping jobs once", () => {
    const cv = {
      ...sampleCV,
      experience: [
        { ...sampleCV.experience[0]!, id: "a", date: "Jan 2020 – Dec 2021" },
        { ...sampleCV.experience[0]!, id: "b", date: "Jan 2021 – Dec 2022" },
      ],
    };
    expect(experienceYears(cv, new Date("2026-01-01"))).toBe(3);
  });
});
