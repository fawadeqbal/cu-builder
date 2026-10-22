import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseResumeText } from "./import";
import {
  csvRecords,
  descriptionBullets,
  fitToLimit,
  isLinkedInExport,
  isLinkedInExportFile,
  isLinkedInPdfText,
  linkedInDate,
  linkedInExportToCv,
  parseCsv,
  parseLinkedInPdfText,
} from "./linkedin";

// A LinkedIn data export as it unzips (Settings → Data privacy → Get a copy of your data).
// Column names and quirks follow real exports: CRLF line ends, a BOM, quoted multi-line
// descriptions, empty "Finished On" for current roles, upper-case proficiency codes.
const EXPORT: Record<string, string> = {
  "Profile.csv":
    "\uFEFFFirst Name,Last Name,Maiden Name,Address,Birth Date,Headline,Summary,Industry,Zip Code,Geo Location,Twitter Handles,Websites,Instant Messengers\r\n" +
    'Ayesha,Khan,,,,"Senior Software Engineer at Systems Ltd | Node.js, TypeScript, AWS","I build backend services that stay fast as they grow.\r\n\r\nI enjoy mentoring and turning messy processes into simple ones.",Software Development,54000,"Lahore, Punjab, Pakistan",,"[PORTFOLIO:https://ayeshakhan.dev,OTHER:https://github.com/ayeshakhan]",\r\n',
  "Positions.csv":
    "Company Name,Title,Description,Location,Started On,Finished On\r\n" +
    'Arbisoft,Associate Software Engineer,"Worked on a learning platform used by universities, mostly on the Django back end.","Lahore, Pakistan",Aug 2019,May 2021\r\n' +
    'Systems Ltd,Senior Software Engineer,"• Led the move of the billing service to three Node.js services, cutting deploy time from 40 minutes to 6\r\n• Mentored four junior engineers through code review and pairing","Lahore, Punjab, Pakistan",Jul 2023,\r\n' +
    'Systems Ltd,Software Engineer,"Built REST APIs in TypeScript and PostgreSQL for the payments team. Wrote the alerting runbook used by on-call engineers, which became the template for every other team in the company.","Lahore, Pakistan",Jun 2021,Jun 2023\r\n',
  "Education.csv":
    "School Name,Start Date,End Date,Notes,Degree Name,Activities\r\n" +
    'University of the Punjab,2015,2019,"CGPA 3.6/4",Bachelor of Science - BS,"Programming society, ACM chapter"\r\n',
  "Skills.csv": "Name\r\nTypeScript\r\nNode.js\r\nPostgreSQL\r\nAmazon Web Services (AWS)\r\nTypeScript\r\n",
  "Languages.csv": "Name,Proficiency\r\nEnglish,FULL_PROFESSIONAL\r\nUrdu,Native or bilingual proficiency\r\n",
  "Certifications.csv":
    "Name,Url,Authority,Started On,Finished On,License Number\r\n" +
    "AWS Certified Developer – Associate,https://www.credly.com/badges/abc,Amazon Web Services (AWS),Mar 2024,Mar 2027,ABC123\r\n",
  "Projects.csv":
    "Title,Description,Url,Started On,Finished On\r\n" +
    '"Open timetable","A timetable app for my university.\nUsed by 2,000 students each term.",https://github.com/ayeshakhan/timetable,Jan 2019,Apr 2019\r\n',
  "Email Addresses.csv":
    "Email Address,Confirmed,Primary,Updated On\r\nold.mail@example.com,Yes,No,1/2/18, 10:00 AM\r\nayesha.khan@example.com,Yes,Yes,3/4/24, 9:12 AM\r\n",
  "PhoneNumbers.csv": "Extension,Number,Type\r\n,+92 300 1234567,Mobile\r\n",
  "Connections.csv": 'Notes:\r\n"When exporting your connection data, you may notice that some of the email addresses are missing."\r\n\r\nFirst Name,Last Name,URL,Email Address,Company,Position,Connected On\r\nAli,Raza,https://www.linkedin.com/in/aliraza,,Acme,Engineer,01 Jan 2024\r\n',
};

describe("CSV reading", () => {
  it("handles quotes, doubled quotes, commas and line breaks inside fields", () => {
    expect(parseCsv('a,b,c\r\n"x, y","say ""hi""","line 1\nline 2"\r\n')).toEqual([
      ["a", "b", "c"],
      ["x, y", 'say "hi"', "line 1\nline 2"],
    ]);
    expect(parseCsv("a,b\nlast,")).toEqual([
      ["a", "b"],
      ["last", ""],
    ]);
  });

  it("keys rows by header and skips LinkedIn's Notes preamble", () => {
    const rows = csvRecords(EXPORT["Connections.csv"]!);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ "first name": "Ali", company: "Acme" });
  });
});

describe("LinkedIn dates and descriptions", () => {
  it("normalises dates", () => {
    expect(linkedInDate("January 2020")).toBe("Jan 2020");
    expect(linkedInDate("Sept 2019")).toBe("Sep 2019");
    expect(linkedInDate("03/2021")).toBe("Mar 2021");
    expect(linkedInDate("2021-11")).toBe("Nov 2021");
    expect(linkedInDate("2019")).toBe("2019");
  });

  it("splits descriptions into bullets", () => {
    expect(descriptionBullets("• One thing\r\n• Another thing")).toEqual(["One thing", "Another thing"]);
    expect(descriptionBullets("- First\n\n- Second")).toEqual(["First", "Second"]);
    expect(descriptionBullets("Did a • Did b")).toEqual(["Did a", "Did b"]);
    const long = "Built REST APIs in TypeScript for the payments team. Wrote the alerting runbook used by on-call engineers, which became the template for other teams.";
    expect(descriptionBullets(long)).toHaveLength(2);
    expect(descriptionBullets("Short paragraph. Two sentences.")).toEqual(["Short paragraph. Two sentences."]);
    expect(descriptionBullets("")).toEqual([]);
  });
});

describe("LinkedIn data export", () => {
  it("is recognised by its Profile.csv", () => {
    expect(isLinkedInExport(["Basic_LinkedInDataExport_10-22-2026/Profile.csv", "Positions.csv"])).toBe(true);
    expect(isLinkedInExport(["word/document.xml", "[Content_Types].xml"])).toBe(false);
    expect(isLinkedInExportFile("Email Addresses.csv")).toBe(true);
    expect(isLinkedInExportFile("messages.csv")).toBe(false);
  });

  const parsed = linkedInExportToCv(EXPORT)!;
  const { cv } = parsed;

  it("maps the profile and contact details", () => {
    expect(cv.personal).toMatchObject({
      name: "Ayesha Khan",
      headline: "Senior Software Engineer at Systems Ltd | Node.js, TypeScript, AWS",
      location: "Lahore, Punjab, Pakistan",
      email: "ayesha.khan@example.com",
      phone: "+92 300 1234567",
      website: "https://ayeshakhan.dev",
      github: "https://github.com/ayeshakhan",
    });
    expect(cv.summary).toBe("I build backend services that stay fast as they grow.\n\nI enjoy mentoring and turning messy processes into simple ones.");
  });

  it("maps positions newest first, with dates and bullets", () => {
    expect(cv.experience.map((e) => [e.role, e.company, e.location, e.date])).toEqual([
      ["Senior Software Engineer", "Systems Ltd", "Lahore, Punjab, Pakistan", "Jul 2023 – Present"],
      ["Software Engineer", "Systems Ltd", "Lahore, Pakistan", "Jun 2021 – Jun 2023"],
      ["Associate Software Engineer", "Arbisoft", "Lahore, Pakistan", "Aug 2019 – May 2021"],
    ]);
    expect(cv.experience[0]!.bullets).toEqual([
      "Led the move of the billing service to three Node.js services, cutting deploy time from 40 minutes to 6",
      "Mentored four junior engineers through code review and pairing",
    ]);
    expect(cv.experience[1]!.bullets).toHaveLength(2);
    expect(cv.experience[2]!.bullets).toEqual(["Worked on a learning platform used by universities, mostly on the Django back end."]);
  });

  it("maps education, skills, languages, certificates and projects", () => {
    expect(cv.education).toMatchObject([{ degree: "Bachelor of Science - BS", school: "University of the Punjab", date: "2015 – 2019", details: "CGPA 3.6/4 · Programming society, ACM chapter" }]);
    expect(cv.skills).toMatchObject([{ category: "Skills", items: "TypeScript, Node.js, PostgreSQL, Amazon Web Services (AWS)" }]);
    expect(cv.languages).toMatchObject([
      { name: "English", level: "Full professional" },
      { name: "Urdu", level: "Native or bilingual" },
    ]);
    expect(cv.certificates).toMatchObject([{ name: "AWS Certified Developer – Associate", issuer: "Amazon Web Services (AWS)", year: "2024", url: "https://www.credly.com/badges/abc" }]);
    expect(cv.projects).toMatchObject([
      { name: "Open timetable", date: "Jan 2019 – Apr 2019", links: ["https://github.com/ayeshakhan/timetable"], bullets: ["A timetable app for my university.", "Used by 2,000 students each term."] },
    ]);
    expect(parsed.warnings).toEqual([]);
  });

  it("returns null without Profile.csv and warns about missing parts", () => {
    expect(linkedInExportToCv({ "Skills.csv": "Name\nGo\n" })).toBeNull();
    const thin = linkedInExportToCv({ "Profile.csv": "First Name,Last Name\nAli,Raza\n" })!;
    expect(thin.cv.personal.name).toBe("Ali Raza");
    expect(thin.warnings.join(" ")).toMatch(/no email/);
    expect(thin.warnings.join(" ")).toMatch(/Positions\.csv/);
  });
});

// Text as unpdf extracts it from a LinkedIn profile's "More → Save to PDF".
const PDF = readFileSync(new URL("./fixtures/linkedin-pdf.txt", import.meta.url), "utf8");

describe("LinkedIn Save to PDF", () => {
  it("is detected, and other CVs are not", () => {
    expect(isLinkedInPdfText(PDF)).toBe(true);
    for (const name of ["classic", "modern"]) {
      expect(isLinkedInPdfText(readFileSync(new URL(`./fixtures/${name}-pdf.txt`, import.meta.url), "utf8"))).toBe(false);
    }
  });

  const { cv, warnings } = parseLinkedInPdfText(PDF);

  it("reads the side column and the name block", () => {
    expect(cv.personal).toMatchObject({
      name: "Ayesha Khan",
      headline: "Senior Software Engineer at Systems Ltd | Node.js, TypeScript, AWS",
      location: "Lahore, Punjab, Pakistan",
      email: "ayesha.khan@example.com",
      phone: "+92 300 1234567",
      linkedin: "www.linkedin.com/in/ayesha-khan-dev",
      website: "ayeshakhan.dev",
      github: "github.com/ayeshakhan",
    });
    expect(cv.skills).toMatchObject([{ items: "TypeScript, Node.js, PostgreSQL" }]);
    expect(cv.languages).toMatchObject([
      { name: "English", level: "Full professional" },
      { name: "Urdu", level: "Native or bilingual" },
    ]);
    expect(cv.certificates.map((c) => c.name)).toEqual(["AWS Certified Developer – Associate", "Professional Scrum Master I"]);
  });

  it("joins the wrapped summary into paragraphs", () => {
    expect(cv.summary).toBe(
      "I build backend services that stay fast as they grow. Over six years I have worked on payments, billing and internal tools for teams in Pakistan and the UK.\nI enjoy mentoring and turning messy processes into simple ones.",
    );
  });

  it("reads grouped roles, durations, locations and wrapped bullets, without page footers", () => {
    expect(cv.experience.map((e) => [e.role, e.company, e.location, e.date])).toEqual([
      ["Senior Software Engineer", "Systems Ltd", "Lahore, Punjab, Pakistan", "Jul 2023 – Present"],
      ["Software Engineer", "Systems Ltd", "Lahore, Pakistan", "Jun 2021 – Jun 2023"],
      ["Associate Software Engineer", "Arbisoft", "Lahore", "Aug 2019 – May 2021"],
      ["Web Developer", "Freelance", "", "Jan 2018 – Jul 2019"],
    ]);
    expect(cv.experience[0]!.bullets).toEqual([
      "Led the move of the billing service from a monolith to three Node.js services, cutting deploy time from 40 minutes to 6.",
      "Mentored four junior engineers through code review and pairing.",
    ]);
    expect(cv.experience[1]!.bullets).toEqual(["Built REST APIs in TypeScript and PostgreSQL for the payments team.", "Wrote the alerting runbook used by on-call engineers."]);
    expect(cv.experience[2]!.bullets).toEqual(["Worked on a learning platform used by universities, mostly on the Django back end."]);
    expect(cv.experience.flatMap((e) => e.bullets).join(" ")).not.toMatch(/Page \d/);
  });

  it("reads education and flags what LinkedIn's PDF leaves out", () => {
    expect(cv.education.map((e) => [e.degree, e.school, e.date])).toEqual([
      ["Bachelor of Science - BS, Computer Science", "University of the Punjab", "2015 – 2019"],
      ["Intermediate, Pre-Engineering", "Punjab Group of Colleges", "2013 – 2015"],
    ]);
    expect(warnings.join(" ")).toMatch(/top skills/);
    expect(warnings.join(" ")).toMatch(/Honours/);
  });

  it("does better than the generic reader on the same text", () => {
    const generic = parseResumeText(PDF).cv;
    expect(generic.experience.filter((e) => e.company === "Systems Ltd")).not.toHaveLength(2);
  });

  it("copes with the main column extracted before the side column, and wrapped education dates", () => {
    const text = [
      "Bilal Ahmed",
      "Product Designer",
      "Karachi, Sindh, Pakistan",
      "Experience",
      "Careem",
      "Product Designer",
      "March 2022 - Present (2 years 8 months)",
      "Designed the rider safety flow.",
      "Education",
      "Indus Valley School of Art and Architecture",
      "Bachelor of Design, Communication Design · (September 2014 -",
      "June 2018)",
      "Page 1 of 1",
      "Contact",
      "bilal@example.com",
      "www.linkedin.com/in/bilalahmed (LinkedIn)",
      "Top Skills",
      "Figma",
    ].join("\n");
    expect(isLinkedInPdfText(text)).toBe(true);
    const out = parseLinkedInPdfText(text).cv;
    expect(out.personal).toMatchObject({ name: "Bilal Ahmed", headline: "Product Designer", location: "Karachi, Sindh, Pakistan", email: "bilal@example.com" });
    expect(out.experience).toMatchObject([{ role: "Product Designer", company: "Careem", date: "Mar 2022 – Present", bullets: ["Designed the rider safety flow."] }]);
    expect(out.education).toMatchObject([{ degree: "Bachelor of Design, Communication Design", date: "Sep 2014 – Jun 2018" }]);
    expect(out.skills[0]?.items).toBe("Figma");
  });
});

describe("fitting LinkedIn's limits", () => {
  it("keeps short text and cuts long text at a sentence or word", () => {
    expect(fitToLimit("Hello there", 220)).toBe("Hello there");
    expect(fitToLimit("One two three four five", 12)).toBe("One two");
    const s = "First sentence is here. Second one is a little longer than that.";
    expect(fitToLimit(s, 40)).toBe("First sentence is here.");
    expect(fitToLimit("x".repeat(30), 10)).toHaveLength(10);
  });
});
