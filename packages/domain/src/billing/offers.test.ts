import { describe, expect, it } from "vitest";
import { effectivePlan, offerById } from "./offers";

const now = new Date("2026-10-22T00:00:00Z");
const later = new Date("2026-11-22T00:00:00Z");
const earlier = new Date("2026-09-22T00:00:00Z");

describe("effectivePlan", () => {
  it("falls back to the base plan", () => {
    expect(effectivePlan({ base: "free", subscriptions: [], passes: [] }, now)).toEqual({ plan: "free", source: "base" });
  });

  it("uses a live subscription and ignores expired or canceled ones", () => {
    const plan = effectivePlan(
      {
        base: "free",
        subscriptions: [
          { plan: "executive", status: "canceled", currentPeriodEnd: later },
          { plan: "premium", status: "active", currentPeriodEnd: later },
          { plan: "executive", status: "active", currentPeriodEnd: earlier },
        ],
        passes: [],
      },
      now,
    );
    expect(plan).toEqual({ plan: "premium", source: "subscription" });
  });

  it("counts a running pass", () => {
    expect(
      effectivePlan({ base: "standard", subscriptions: [], passes: [{ plan: "premium", startsAt: earlier, endsAt: later }] }, now),
    ).toEqual({ plan: "premium", source: "pass" });
  });

  it("knows its offers", () => {
    expect(offerById("pass_7d")).toMatchObject({ kind: "pass", days: 7, plan: "premium" });
  });
});
