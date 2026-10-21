import { describe, expect, it } from "vitest";
import { plural, slugify, wordCount } from "./strings";

describe("strings", () => {
  it("slugifies names", () => {
    expect(slugify("Sara Ahmed's CV!")).toBe("sara-ahmed-s-cv");
    expect(slugify("   ", "cv")).toBe("cv");
    expect(slugify("Ünïcode Name")).toBe("unicode-name");
  });

  it("counts words", () => {
    expect(wordCount("  one two\nthree ")).toBe(3);
    expect(wordCount("")).toBe(0);
  });

  it("pluralises", () => {
    expect(plural(1, "job")).toBe("1 job");
    expect(plural(2, "entry", "entries")).toBe("2 entries");
  });
});
