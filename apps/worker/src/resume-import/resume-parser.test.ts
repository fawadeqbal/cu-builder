import { describe, expect, it } from "vitest";
import { jsonToCv, markupToText, rtfToText } from "./resume-parser.js";

describe("file text extraction", () => {
  it("reads HTML and OpenDocument markup as lines", () => {
    expect(markupToText("<h1>Ayesha Khan</h1><p>Engineer &amp; mentor</p><ul><li>Built APIs</li><li>Led team</li></ul>")).toBe("Ayesha Khan\nEngineer & mentor\n- Built APIs\n- Led team");
    expect(markupToText('<text:p>Skills</text:p><text:list-item><text:p>React</text:p></text:list-item>')).toBe("Skills\n- React");
  });

  it("reads RTF paragraphs and drops formatting", () => {
    const rtf = String.raw`{\rtf1\ansi{\fonttbl{\f0 Arial;}}\f0\fs24 Ayesha Khan\par Software Engineer \'96 Lahore\par}`;
    expect(rtfToText(rtf)).toBe("Ayesha Khan\nSoftware Engineer – Lahore");
  });
});

describe("JSON imports", () => {
  it("accepts our own backup", () => {
    expect(jsonToCv(JSON.stringify({ personal: { name: "Ali" }, experience: [] }))?.personal.name).toBe("Ali");
  });

  it("converts a JSON Resume file", () => {
    const cv = jsonToCv(
      JSON.stringify({
        basics: { name: "Ali Raza", label: "Engineer", email: "ali@example.com", profiles: [{ network: "GitHub", url: "https://github.com/ali" }] },
        work: [{ name: "Systems Ltd", position: "Developer", startDate: "2022-01", highlights: ["Built APIs"] }],
        skills: [{ name: "Backend", keywords: ["Node.js", "PostgreSQL"] }],
      }),
    );
    expect(cv).toMatchObject({ personal: { name: "Ali Raza", headline: "Engineer", github: "https://github.com/ali" }, skills: [{ category: "Backend", items: "Node.js, PostgreSQL" }] });
    expect(cv?.experience[0]).toMatchObject({ role: "Developer", company: "Systems Ltd", date: "2022-01 – Present", bullets: ["Built APIs"] });
  });

  it("rejects other JSON", () => {
    expect(jsonToCv('{"hello": 1}')).toBeNull();
    expect(jsonToCv("not json")).toBeNull();
  });
});
