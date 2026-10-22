import { describe, expect, it } from "vitest";
import { parseResumeText } from "./import";

const TEXT = `
Sara Ahmed
Full Stack Developer
React · Next.js · Node.js · PostgreSQL
sara.ahmed@example.com | +92 300 1234567 | Lahore, Pakistan
linkedin.com/in/sara-ahmed  github.com/sara-ahmed

PROFILE
Full stack developer with four years of experience building web applications.
Comfortable owning a feature end to end.

WORK EXPERIENCE
Full Stack Developer — Bright Labs        Mar 2024 – Present
Lahore, Pakistan
• Build and maintain a multi-tenant booking platform used by 120+ clinics.
• Designed the PostgreSQL schema and indexes.
Frontend Developer, Pixel Works   Jun 2022 - Feb 2024
- Turned Figma designs into a reusable React component library.

EDUCATION
BS Computer Science — University of the Punjab   2018 – 2022
CGPA 3.4 / 4.0

SKILLS
Frontend: React, Next.js, TypeScript
Backend: Node.js, Express, NestJS

PROJECTS
TaskFlow — Team Task Board  2025  github.com/sara-ahmed/taskflow
• Kanban board with drag and drop.

CERTIFICATIONS
AWS Cloud Practitioner — Amazon Web Services, 2024

LANGUAGES
English (Professional), Urdu (Native)
`;

describe("parseResumeText", () => {
  const { cv, warnings } = parseResumeText(TEXT);

  it("finds contact details", () => {
    expect(cv.personal).toMatchObject({
      name: "Sara Ahmed",
      headline: "Full Stack Developer",
      email: "sara.ahmed@example.com",
      phone: "+92 300 1234567",
      linkedin: "linkedin.com/in/sara-ahmed",
      github: "github.com/sara-ahmed",
    });
  });

  it("splits experience into dated entries with bullets", () => {
    expect(cv.experience).toHaveLength(2);
    expect(cv.experience[0]).toMatchObject({ role: "Full Stack Developer", company: "Bright Labs", date: "Mar 2024 – Present" });
    expect(cv.experience[0]!.bullets).toHaveLength(2);
    expect(cv.experience[1]).toMatchObject({ role: "Frontend Developer", company: "Pixel Works", date: "Jun 2022 – Feb 2024" });
  });

  it("reads the other sections", () => {
    expect(cv.summary).toMatch(/^Full stack developer/);
    expect(cv.education[0]).toMatchObject({ degree: "BS Computer Science", school: "University of the Punjab", date: "2018 – 2022" });
    expect(cv.skills.map((s) => s.category)).toEqual(["Frontend", "Backend"]);
    expect(cv.projects[0]).toMatchObject({ name: "TaskFlow — Team Task Board", date: "2025" });
    expect(cv.projects[0]!.links).toEqual(["github.com/sara-ahmed/taskflow"]);
    expect(cv.certificates[0]).toMatchObject({ name: "AWS Cloud Practitioner", year: "2024" });
    expect(cv.languages.map((l) => `${l.name}:${l.level}`)).toEqual(["English:Professional", "Urdu:Native"]);
    expect(warnings).toEqual([]);
  });

  it("warns when it finds nothing useful", () => {
    expect(parseResumeText("hello world").warnings.length).toBeGreaterThan(0);
  });
});
