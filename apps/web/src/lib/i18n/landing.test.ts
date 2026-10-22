import { describe, expect, it } from "vitest";
import { landingAr, landingEn, landingUr } from "./landing";

const vars = (s: string) => [...s.matchAll(/\{(\w+)\}|\[(number|%)\]/g)].map((m) => m[0]).sort();

describe("landing translations", () => {
  const keys = Object.keys(landingEn) as (keyof typeof landingEn)[];

  it.each([
    ["Urdu", landingUr],
    ["Arabic", landingAr],
  ])("%s covers every landing key", (_, dict) => {
    expect(keys.filter((k) => !dict[k])).toEqual([]);
  });

  it.each([
    ["Urdu", landingUr],
    ["Arabic", landingAr],
  ])("%s keeps every {placeholder} and [number] token", (_, dict) => {
    const broken = keys.filter((k) => dict[k] && JSON.stringify(vars(dict[k]!)) !== JSON.stringify(vars(landingEn[k])));
    expect(broken).toEqual([]);
  });

  it("prefixes landing page text with landing.", () => {
    expect(keys.every((k) => /^(landing|review|help)\./.test(k))).toBe(true);
  });
});
