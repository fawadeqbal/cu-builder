import { OfflineAssistant } from "@cvb/ai";
import type { ResumeImportJob } from "@cvb/contracts";
import { InMemoryStorage } from "@cvb/storage";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
// Text extraction (PDF, Word, ODT, RTF, HTML) is tested in @cvb/extract.
import { FileResumeParser, jsonToCv } from "./resume-parser.js";

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

describe("LinkedIn imports", () => {
  const job = (fileKey: string, mimeType: ResumeImportJob["mimeType"]): ResumeImportJob => ({ importId: "i1", userId: "u1", fileKey, fileName: "x", mimeType });

  it("maps a LinkedIn data export ZIP without AI", async () => {
    const storage = new InMemoryStorage();
    await storage.put(
      "imports/u1/a.zip",
      zipSync({
        "Profile.csv": strToU8("First Name,Last Name,Headline\nAyesha,Khan,Backend engineer\n"),
        "Positions.csv": strToU8('Company Name,Title,Description,Location,Started On,Finished On\nArbisoft,Engineer,"Built APIs\nLed reviews",Lahore,Jan 2020,\n'),
      }),
    );
    const out = await new FileResumeParser(storage, new OfflineAssistant()).parse(job("imports/u1/a.zip", "application/x-linkedin-export+zip"));
    expect(out.cv.personal).toMatchObject({ name: "Ayesha Khan", headline: "Backend engineer" });
    expect(out.cv.experience[0]).toMatchObject({ company: "Arbisoft", date: "Jan 2020 – Present", bullets: ["Built APIs", "Led reviews"] });
  });

  it("rejects a ZIP without Profile.csv", async () => {
    const storage = new InMemoryStorage();
    await storage.put("imports/u1/b.zip", zipSync({ "Skills.csv": strToU8("Name\nGo\n") }));
    await expect(new FileResumeParser(storage, new OfflineAssistant()).parse(job("imports/u1/b.zip", "application/x-linkedin-export+zip"))).rejects.toThrow(/no Profile\.csv/);
  });

  it("reads LinkedIn 'Save to PDF' text with the LinkedIn reader", async () => {
    const storage = new InMemoryStorage();
    const text = [
      "Contact", "sara@example.com", "www.linkedin.com/in/sara (LinkedIn)", "Top Skills", "React", "Sara Ahmed", "Frontend Developer", "Lahore, Pakistan",
      "Experience", "Pixel Works", "Frontend Developer", "June 2022 - Present (2 years 5 months)", "Remote", "Built the component library.", "Page 1 of 1",
    ].join("\n");
    await storage.put("imports/u1/c.txt", strToU8(text));
    const out = await new FileResumeParser(storage, new OfflineAssistant()).parse(job("imports/u1/c.txt", "text/plain"));
    expect(out.cv.personal).toMatchObject({ name: "Sara Ahmed", headline: "Frontend Developer", email: "sara@example.com" });
    expect(out.cv.experience).toMatchObject([{ role: "Frontend Developer", company: "Pixel Works", location: "Remote", date: "Jun 2022 – Present" }]);
  });
});
