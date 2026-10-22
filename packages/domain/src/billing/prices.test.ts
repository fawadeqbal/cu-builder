import { describe, expect, it } from "vitest";
import { OFFERS, offerById } from "./offers";
import { CURRENCIES, DEFAULT_PRICES, checkPrice, formatMinor, offersIn, priceTable, resolvePrice, yearlySaving } from "./prices";

describe("prices", () => {
  it("has a default for every offer in every currency", () => {
    for (const c of CURRENCIES) for (const o of OFFERS) expect(DEFAULT_PRICES[c][o.id]).toBeGreaterThan(0);
  });

  it("keeps the US dollar defaults of the offers", () => {
    for (const o of OFFERS) expect(resolvePrice(o.id, "usd").amount).toBe(o.priceCents);
  });

  it("prices PKR in paisa", () => {
    expect(resolvePrice("standard_monthly", "pkr").amount).toBe(99_000);
    expect(resolvePrice("pass_7d", "pkr").amount).toBe(69_000);
    expect(resolvePrice("executive_yearly", "pkr").amount).toBe(4_990_000);
    expect(resolvePrice("credits_100", "pkr").amount).toBe(59_000);
  });

  it("applies an override only to its offer and currency", () => {
    const overrides = [{ offer: "pass_7d" as const, currency: "pkr" as const, amount: 49_900 }];
    expect(resolvePrice("pass_7d", "pkr", overrides)).toEqual({
      offer: "pass_7d",
      currency: "pkr",
      amount: 49_900,
      defaultAmount: 69_000,
      overridden: true,
    });
    expect(resolvePrice("pass_7d", "usd", overrides)).toMatchObject({ amount: 900, overridden: false });
    expect(resolvePrice("pass_30d", "pkr", overrides)).toMatchObject({ amount: 149_000, overridden: false });
  });

  it("ignores an override that can't be charged", () => {
    const overrides = [{ offer: "pass_7d" as const, currency: "usd" as const, amount: 10 }];
    expect(resolvePrice("pass_7d", "usd", overrides)).toMatchObject({ amount: 900, overridden: false });
  });

  it("prices whole offers and the admin table", () => {
    const pkr = offersIn("pkr", [{ offer: "premium_monthly", currency: "pkr", amount: 150_000 }]);
    expect(pkr.find((o) => o.id === "premium_monthly")?.priceCents).toBe(150_000);
    expect(pkr.find((o) => o.id === "premium_monthly")).toMatchObject({ kind: "subscription", plan: "premium" });
    // Offers themselves are untouched.
    expect(offerById("premium_monthly").priceCents).toBe(1_500);
    expect(priceTable()).toHaveLength(OFFERS.length * CURRENCIES.length);
  });

  it("checks prices against Stripe's limits", () => {
    expect(checkPrice("usd", 700)).toBeNull();
    expect(checkPrice("usd", 49)).toMatch(/lowest/);
    expect(checkPrice("pkr", 10_000)).toMatch(/Rs 200/);
    expect(checkPrice("pkr", 99.5)).toMatch(/whole/);
    expect(checkPrice("usd", 100_000_000)).toMatch(/highest/);
  });

  it("formats and computes the yearly saving", () => {
    expect(formatMinor(99_000, "pkr")).toBe("Rs 990");
    expect(formatMinor(1_950, "usd")).toBe("$19.50");
    expect(yearlySaving(700, 5_900)).toBe(30);
    expect(yearlySaving(99_000, 990_000)).toBe(17);
    expect(yearlySaving(0, 100)).toBe(0);
  });
});
