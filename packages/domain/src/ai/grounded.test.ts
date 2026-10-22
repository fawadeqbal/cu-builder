import { describe, expect, it } from "vitest";
import { emptyCV } from "../resume/model";
import { groundCv, isGrounded, sourceIndex } from "./grounded";

const text = `Ayesha Khan
ayesha@example.com · +92 300 1234567 · Lahore
Experience
Software Engineer — Systems Ltd (2022 – Present)
- Built payment APIs handling 1M requests a day
Skills: React, Node.js, PostgreSQL`;

describe("isGrounded", () => {
  const src = sourceIndex(text);
  it("accepts copied text and rejects invented text", () => {
    expect(isGrounded("Built payment APIs handling 1M requests a day", src)).toBe(true);
    expect(isGrounded("Led a team of 12 engineers to win an award", src)).toBe(false);
    expect(isGrounded("Systems Ltd", src)).toBe(true);
    expect(isGrounded("Google", src)).toBe(false);
  });
});

describe("groundCv", () => {
  it("drops invented values and fills contacts from the fallback", () => {
    const ai = {
      ...emptyCV,
      personal: { ...emptyCV.personal, name: "Ayesha Khan", email: "" },
      experience: [{ id: "e1", role: "Software Engineer", company: "Systems Ltd", location: "", date: "2022 – Present", bullets: ["Built payment APIs handling 1M requests a day", "Mentored 10 junior developers"], stack: "" }],
      skills: [{ id: "s1", category: "Skills", items: "React, Node.js, PostgreSQL" }],
    };
    const fallback = { ...emptyCV, personal: { ...emptyCV.personal, email: "ayesha@example.com" } };
    const { cv, dropped } = groundCv(ai, text, fallback);
    expect(cv.experience[0]!.bullets).toEqual(["Built payment APIs handling 1M requests a day"]);
    expect(cv.personal.email).toBe("ayesha@example.com");
    expect(dropped).toBe(1);
  });
});
