import { describe, expect, it } from "vitest";
import { detectCurrency } from "./currency";
import { formatPrice } from "./plans";

describe("detectCurrency", () => {
  it("picks rupees in Pakistan's time zone", () => {
    expect(detectCurrency({ timeZone: "Asia/Karachi", languages: ["en-US"] })).toBe("pkr");
  });

  it("picks rupees for Urdu and Pakistani locales", () => {
    expect(detectCurrency({ timeZone: "Europe/London", languages: ["ur"] })).toBe("pkr");
    expect(detectCurrency({ timeZone: "UTC", languages: ["en-GB", "en_PK"] })).toBe("pkr");
    expect(detectCurrency({ languages: ["ur-PK"] })).toBe("pkr");
  });

  it("uses dollars everywhere else", () => {
    expect(detectCurrency({ timeZone: "America/New_York", languages: ["en-US", "en"] })).toBe("usd");
    expect(detectCurrency({ timeZone: "Asia/Dubai", languages: ["ar-AE", null, ""] })).toBe("usd");
    expect(detectCurrency({})).toBe("usd");
  });
});

describe("formatPrice", () => {
  it("formats minor units in either currency", () => {
    expect(formatPrice(700, "usd")).toBe("$7");
    expect(formatPrice(1_950, "usd")).toBe("$19.50");
    expect(formatPrice(99_000, "pkr")).toMatch(/^Rs\s?990$/);
  });
});
