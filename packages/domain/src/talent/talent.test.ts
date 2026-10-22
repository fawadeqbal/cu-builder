import { describe, expect, it } from "vitest";
import { emptyCV } from "../resume/model";
import type { CV } from "../resume/types";
import {
  TALENT_LIMITS,
  canSearchTalent,
  contactDecision,
  contactsLeft,
  isDiscoverable,
  normalizeRoles,
  redactContacts,
  searchTerms,
  sharedTalentCV,
  talentMatches,
  talentScore,
  talentSnapshot,
  topSkills,
  type TalentListing,
} from "./index";

const cv: CV = {
  ...emptyCV,
  personal: {
    ...emptyCV.personal,
    name: "Ayesha Khan",
    headline: "Frontend developer",
    email: "ayesha@example.com",
    phone: "+92 300 1234567",
    location: "Gulberg, Lahore",
    linkedin: "linkedin.com/in/ayesha",
  },
  summary: "Five years building React apps (2019 - 2024). Reach me at ayesha@example.com or 0300 1234567.",
  experience: [
    { id: "e1", role: "Senior Frontend Engineer", company: "Acme", location: "Lahore", date: "2021 – Present", bullets: ["Led the design system"], stack: "React" },
    { id: "e2", role: "frontend developer", company: "Beta", location: "Karachi", date: "2019 – 2021", bullets: ["Built dashboards"], stack: "" },
  ],
  projects: [{ id: "p1", name: "Side project", date: "", links: ["https://x.dev"], bullets: ["A thing"], stack: "" }],
  skills: [
    { id: "s1", category: "Frontend", items: "React, TypeScript, Next.js" },
    { id: "s2", category: "Tools", items: "Git; Figma, react" },
  ],
  education: [{ id: "ed1", degree: "BS Computer Science", school: "FAST", date: "2019", details: "CGPA 3.6, roll no. 1234" }],
  certificates: [{ id: "c1", name: "AWS CCP", issuer: "AWS", year: "2023", url: "https://aws.example/cert" }],
  details: { ...emptyCV.details, idNumber: "35202-1234567-1", religion: "Islam" },
  photo: "data:image/jpeg;base64,xyz",
};

const listing: TalentListing = { headline: "Frontend developer", location: "Lahore, Pakistan", roles: ["Frontend developer", "React developer"], ...talentSnapshot(cv) };

describe("talent search", () => {
  it("is for agencies only", () => {
    expect(canSearchTalent("agency")).toBe(true);
    expect(canSearchTalent("university")).toBe(false);
    expect(canSearchTalent("partner")).toBe(false);
  });

  it("takes titles and unique skills from the CV", () => {
    const s = talentSnapshot(cv);
    expect(s.titles).toEqual(["Frontend developer", "Senior Frontend Engineer"]);
    expect(s.skills).toEqual(["React", "TypeScript", "Next.js", "Git", "Figma"]);
  });

  it("cleans roles", () => {
    expect(normalizeRoles([" Designer ", "designer", "", "A", "B", "C", "D", "E"])).toEqual(["Designer", "A", "B", "C", "D"]);
  });

  it("matches every keyword, the place and the role", () => {
    expect(searchTerms("React,  TypeScript lahore")).toEqual(["react", "typescript", "lahore"]);
    expect(talentMatches(listing, { q: "react typescript" })).toBe(true);
    expect(talentMatches(listing, { q: "react python" })).toBe(false);
    expect(talentMatches(listing, { location: "lahore" })).toBe(true);
    expect(talentMatches(listing, { location: "Karachi" })).toBe(false);
    expect(talentMatches(listing, { role: "react developer" })).toBe(true);
    expect(talentMatches(listing, { role: "accountant" })).toBe(false);
    expect(talentMatches(listing, {})).toBe(true);
  });

  it("does not search contact details", () => {
    expect(talentMatches(listing, { q: "ayesha@example.com" })).toBe(false);
    expect(talentMatches(listing, { q: "Acme" })).toBe(false);
  });

  it("ranks exact skill hits first and shows matching skills first", () => {
    expect(talentScore(listing, { q: "figma" })).toBeGreaterThan(talentScore(listing, { q: "fig" }));
    expect(topSkills(listing.skills, { q: "figma" })[0]).toBe("Figma");
    expect(topSkills(listing.skills)).toHaveLength(Math.min(listing.skills.length, TALENT_LIMITS.skillsShown));
  });

  it("is visible only when switched on, with a live CV, on an account in good standing", () => {
    expect(isDiscoverable({ visible: true, resumeDeleted: false, userBlocked: false })).toBe(true);
    expect(isDiscoverable({ visible: false, resumeDeleted: false, userBlocked: false })).toBe(false);
    expect(isDiscoverable({ visible: true, resumeDeleted: true, userBlocked: false })).toBe(false);
    expect(isDiscoverable({ visible: true, resumeDeleted: false, userBlocked: true })).toBe(false);
  });
});

describe("what a recruiter sees", () => {
  it("shows the CV as written for a full share, without the ID number", () => {
    const shared = sharedTalentCV(cv, "full");
    expect(shared.personal.email).toBe("ayesha@example.com");
    expect(shared.experience[0]?.bullets).toEqual(["Led the design system"]);
    expect(shared.details.idNumber).toBe("");
    expect(shared.details.religion).toBe("Islam");
  });

  it("removes every contact and personal detail from a summary", () => {
    const shared = sharedTalentCV(cv, "summary", "Lahore");
    expect(shared.personal).toMatchObject({ name: "Ayesha", email: "", phone: "", linkedin: "", website: "", location: "Lahore" });
    expect(shared.summary).not.toMatch(/ayesha@|0300/);
    expect(shared.summary).toContain("2019 - 2024");
    expect(shared.experience.map((e) => e.role)).toEqual(["Senior Frontend Engineer", "frontend developer"]);
    expect(shared.experience.every((e) => e.bullets.length === 0)).toBe(true);
    expect(shared.projects).toEqual([]);
    expect(shared.education[0]?.details).toBe("");
    expect(shared.certificates[0]?.url).toBe("");
    expect(shared.details.religion).toBe("");
    expect(shared.photo).toBe("");
    expect(JSON.stringify(shared)).not.toMatch(/ayesha@|1234567|in\/ayesha/);
  });

  it("redacts emails, phone numbers and links but keeps years", () => {
    expect(redactContacts("Call +92 300 1234567, mail a@b.co, see https://x.dev, 2015-2019")).toBe(
      "Call [hidden], mail [hidden], see [hidden] 2015-2019",
    );
  });
});

describe("contact limits", () => {
  const now = new Date("2026-10-22T12:00:00Z");
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);

  it("allows a first message and counts what's left", () => {
    expect(contactDecision({ sentByMember: [], lastFromOrg: null, now })).toEqual({ ok: true, left: 19 });
    expect(contactsLeft([hoursAgo(1), hoursAgo(30)], now)).toBe(19);
  });

  it("stops a member at twenty messages in 24 hours", () => {
    const sent = Array.from({ length: 20 }, (_, i) => hoursAgo(i + 1));
    const d = contactDecision({ sentByMember: sent, lastFromOrg: null, now });
    expect(d).toMatchObject({ ok: false, reason: "daily_limit" });
    // The oldest of the twenty (20 hours ago) leaves the window in 4 hours.
    if (!d.ok) expect(d.retryAt).toEqual(new Date(now.getTime() + 4 * 3600_000));
    expect(contactsLeft(sent, now)).toBe(0);
  });

  it("forgets messages older than a day", () => {
    const sent = Array.from({ length: 20 }, () => hoursAgo(25));
    expect(contactDecision({ sentByMember: sent, lastFromOrg: null, now }).ok).toBe(true);
  });

  it("lets an organisation write to the same person once a week", () => {
    expect(contactDecision({ sentByMember: [], lastFromOrg: hoursAgo(24 * 3), now })).toMatchObject({ ok: false, reason: "recently_contacted" });
    expect(contactDecision({ sentByMember: [], lastFromOrg: hoursAgo(24 * 8), now }).ok).toBe(true);
  });
});
