import { describe, expect, it } from "vitest";
import { splitItems } from "./shared";

describe("splitItems", () => {
  it("splits on commas, semicolons, middots and bars, but not inside brackets", () => {
    expect(splitItems("React, Next.js (App Router, Server Components) · AWS (EC2, S3, Lambda); Node | Go")).toEqual([
      "React",
      "Next.js (App Router, Server Components)",
      "AWS (EC2, S3, Lambda)",
      "Node",
      "Go",
    ]);
  });
  it("survives unbalanced brackets and blanks", () => {
    expect(splitItems("a), b, , c")).toEqual(["a)", "b", "c"]);
  });
});
