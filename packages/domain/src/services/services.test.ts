import { describe, expect, it } from "vitest";
import { sampleCV } from "../resume/sample";
import {
  applyAtAnchor,
  assertTransition,
  availableSlots,
  canTransition,
  cvLines,
  dueDate,
  googleCalendarUrl,
  icsEvent,
  includedReviewAvailable,
  missingIntake,
  nextRating,
  priceFor,
  splitPayment,
  textAt,
  zonedTime,
} from "./index";

describe("service catalogue", () => {
  it("prices, splits and schedules", () => {
    expect(priceFor("review")).toBe(3900);
    expect(priceFor("coaching", { durationMin: 45 })).toBe(5900);
    expect(splitPayment(3900)).toEqual({ commissionCents: 975, expertCents: 2925 });
    expect(dueDate("review_rush", new Date("2026-10-22T10:00:00Z"))?.toISOString()).toBe("2026-10-23T10:00:00.000Z");
    expect(dueDate("coaching", new Date(), null)).toBeNull();
    expect(missingIntake("writing", { target: "PM" })).toEqual(["Your three proudest achievements"]);
  });

  it("includes one 48-hour review a month on Executive", () => {
    expect(includedReviewAvailable("executive", "review", 0)).toBe(true);
    expect(includedReviewAvailable("executive", "review", 1)).toBe(false);
    expect(includedReviewAvailable("executive", "review_rush", 0)).toBe(false);
    expect(includedReviewAvailable("premium", "review", 0)).toBe(false);
  });

  it("averages ratings", () => {
    expect(nextRating(0, 0, 5)).toEqual({ avg: 5, count: 1 });
    expect(nextRating(5, 1, 4)).toEqual({ avg: 4.5, count: 2 });
  });
});

describe("order status", () => {
  it("allows only the lifecycle's moves", () => {
    expect(canTransition("pending_payment", "paid")).toBe(true);
    expect(canTransition("delivered", "in_progress")).toBe(true);
    expect(canTransition("refunded", "paid")).toBe(false);
    expect(() => assertTransition("cancelled", "paid")).toThrow(/can't become paid/);
  });
});

describe("coaching slots", () => {
  it("converts a zone's wall clock to UTC", () => {
    expect(zonedTime(2026, 9, 26, 9, 0, "Asia/Karachi").toISOString()).toBe("2026-10-26T04:00:00.000Z");
    // London is on GMT after the last Sunday of October.
    expect(zonedTime(2026, 9, 26, 9, 0, "Europe/London").toISOString()).toBe("2026-10-26T09:00:00.000Z");
  });

  it("lists free starts inside windows, after the notice period, without overlaps", () => {
    const now = new Date("2026-10-22T00:00:00Z"); // Thursday
    const slots = availableSlots({
      windows: [{ day: 1, start: "09:00", end: "11:00" }], // Mondays 9–11
      timeZone: "Asia/Karachi",
      durationMin: 60,
      now,
      days: 7,
      booked: [{ start: new Date("2026-10-26T04:30:00Z"), end: new Date("2026-10-26T05:30:00Z") }],
    });
    // 09:00, 09:30, 10:00 local = 04:00, 04:30, 05:00 UTC; the 04:30–05:30 booking overlaps all three.
    expect(slots.map((s) => s.toISOString())).toEqual([]);
    const free = availableSlots({ windows: [{ day: 1, start: "09:00", end: "11:00" }], timeZone: "Asia/Karachi", durationMin: 60, now, days: 7 });
    expect(free.map((s) => s.toISOString())).toEqual(["2026-10-26T04:00:00.000Z", "2026-10-26T04:30:00.000Z", "2026-10-26T05:00:00.000Z"]);
  });

  it("writes calendar files and links", () => {
    const start = new Date("2026-10-26T04:00:00Z");
    const end = new Date("2026-10-26T05:00:00Z");
    const ics = icsEvent({ uid: "o1@cvbuilder", start, end, title: "Coaching, with Ali", description: "Join: link", url: "https://meet.jit.si/cvb-o1", now: start });
    expect(ics).toContain("DTSTART:20261026T040000Z");
    expect(ics).toContain("SUMMARY:Coaching\\, with Ali");
    expect(googleCalendarUrl({ start, end, title: "Coaching", description: "x" })).toContain("dates=20261026T040000Z%2F20261026T050000Z");
  });
});

describe("comment anchors", () => {
  it("addresses lines and applies suggestions", () => {
    const cv = sampleCV;
    const lines = cvLines(cv);
    const bullet = lines.find((l) => l.anchor.startsWith("experience.") && l.anchor.includes(".bullets."))!;
    expect(textAt(cv, bullet.anchor)).toBe(bullet.text);
    const next = applyAtAnchor(cv, bullet.anchor, "Shipped X");
    expect(textAt(next, bullet.anchor)).toBe("Shipped X");
    expect(textAt(cv, bullet.anchor)).toBe(bullet.text);
    expect(applyAtAnchor(cv, "experience.missing.bullets.0", "x")).toBe(cv);
    expect(textAt(applyAtAnchor(cv, "summary", "New"), "summary")).toBe("New");
  });
});
