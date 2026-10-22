import { describe, expect, it } from "vitest";
import { looksLikeToken, normaliseAppUrl, originPattern } from "./settings";

describe("settings", () => {
  it("normalises the app address", () => {
    expect(normaliseAppUrl("cv.example.com/")).toBe("https://cv.example.com");
    expect(normaliseAppUrl("http://localhost:3000")).toBe("http://localhost:3000");
    expect(normaliseAppUrl("localhost:3000/")).toBe("http://localhost:3000");
    expect(originPattern("https://cv.example.com/app")).toBe("https://cv.example.com/*");
    expect(() => normaliseAppUrl("ftp://x")).toThrow();
  });

  it("recognises keys", () => {
    expect(looksLikeToken("cvb_abcdefghijklmnopqrstuvwxyz012345")).toBe(true);
    expect(looksLikeToken("sk_live_123")).toBe(false);
  });
});
