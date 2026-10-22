import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseResumeText } from "./import";

// Text extracted (unpdf) from PDFs this app exported with the Classic and Modern templates.
const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}-pdf.txt`, import.meta.url), "utf8");

describe.each(["classic", "modern"])("parsing an exported %s PDF", (name) => {
  const { cv, warnings } = parseResumeText(fixture(name));

  it("recovers the essentials", () => {
    expect(warnings).toEqual([]);
    expect(cv.personal).toMatchObject({
      name: "Sara Ahmed",
      headline: "Full Stack Developer",
      email: "sara.ahmed@example.com",
      website: "saraahmed.dev",
      github: "github.com/sara-ahmed",
      linkedin: "linkedin.com/in/sara-ahmed",
    });
    expect(cv.summary).toMatch(/^Full stack developer with four years/);
  });

  it("recovers jobs, education and certificates", () => {
    expect(cv.experience.map((e) => [e.role, e.company, e.location, e.date])).toEqual([
      ["Full Stack Developer", "Bright Labs", "Lahore, Pakistan", "Mar 2024 – Present"],
      ["Frontend Developer", "Pixel Works", "Remote", "Jun 2022 – Feb 2024"],
    ]);
    expect(cv.experience[0]!.bullets).toHaveLength(4);
    expect(cv.experience[0]!.stack).toMatch(/^Next\.js, React/);
    expect(cv.education[0]).toMatchObject({ degree: "BS Computer Science", school: "University of the Punjab", date: "2018 – 2022" });
    expect(cv.certificates[0]).toMatchObject({ name: "AWS Cloud Practitioner", issuer: "Amazon Web Services", year: "2024" });
  });
});
