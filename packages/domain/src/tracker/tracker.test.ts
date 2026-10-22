import { describe, expect, it } from "vitest";
import { columnKey, compareOffers, DEFAULT_COLUMNS, EMPTY_OFFER, fillTemplate, NEGOTIATION_TEMPLATES, positionBetween, progressSince, remindersFor, totalComp } from "./index";

describe("board", () => {
  it("makes unique column keys", () => {
    expect(columnKey("Phone screen", DEFAULT_COLUMNS.map((c) => c.key))).toBe("phone-screen");
    expect(columnKey("Saved", DEFAULT_COLUMNS.map((c) => c.key))).toBe("saved-2");
  });

  it("orders by fractional positions", () => {
    expect(positionBetween(null, null)).toBe(1000);
    expect(positionBetween(1000, 2000)).toBe(1500);
    expect(positionBetween(null, 1000)).toBe(0);
    expect(positionBetween(3000, null)).toBe(4000);
  });
});

describe("reminders", () => {
  const base = { company: "Acme", title: "Engineer", appliedAt: null, interviewAt: null, deadlineAt: null, followUpDays: null };
  it("plans follow-up, interview and deadline reminders", () => {
    const r = remindersFor({
      ...base,
      status: "applied",
      appliedAt: new Date("2026-10-01"),
      followUpDays: 7,
      interviewAt: new Date("2026-10-20T10:00:00Z"),
      deadlineAt: new Date("2026-10-30"),
    });
    expect(r.map((x) => x.kind)).toEqual(["follow_up", "interview", "deadline"]);
    expect(r[0]!.dueAt.toISOString().slice(0, 10)).toBe("2026-10-08");
    expect(r[1]!.dueAt.toISOString()).toBe("2026-10-19T10:00:00.000Z");
  });

  it("skips the follow-up once the application has moved on", () => {
    expect(remindersFor({ ...base, status: "interview", appliedAt: new Date(), followUpDays: 5 })).toEqual([]);
  });
});

describe("progress", () => {
  it("counts this week's activity", () => {
    const since = new Date("2026-10-15");
    const s = progressSince(
      [
        { status: "applied", createdAt: new Date("2026-10-16"), appliedAt: new Date("2026-10-16"), interviewAt: null, updatedAt: new Date("2026-10-16") },
        { status: "interview", createdAt: new Date("2026-09-01"), appliedAt: new Date("2026-09-02"), interviewAt: new Date("2026-10-18"), updatedAt: new Date("2026-10-18") },
        { status: "offer", createdAt: new Date("2026-09-01"), appliedAt: null, interviewAt: null, updatedAt: new Date("2026-10-19") },
      ],
      since,
    );
    expect(s).toEqual({ added: 1, applied: 1, interviews: 1, offers: 1, total: 3 });
  });
});

describe("offers", () => {
  it("adds up pay and picks the best", () => {
    const a = { id: "a", offer: { ...EMPTY_OFFER, baseSalary: 100, bonus: 10, currency: "USD", growth: 3 } };
    const b = { id: "b", offer: { ...EMPTY_OFFER, baseSalary: 105, currency: "USD", growth: 5 } };
    expect(totalComp(a.offer)).toBe(110);
    expect(compareOffers([a, b])).toEqual({ bestTotal: "a", bestGrowth: "b" });
  });

  it("does not compare pay across currencies", () => {
    const a = { id: "a", offer: { ...EMPTY_OFFER, baseSalary: 100, currency: "USD" } };
    const b = { id: "b", offer: { ...EMPTY_OFFER, baseSalary: 9000, currency: "PKR" } };
    expect(compareOffers([a, b]).bestTotal).toBeNull();
  });

  it("fills templates and leaves unknown placeholders visible", () => {
    const t = NEGOTIATION_TEMPLATES[0]!;
    const out = fillTemplate(t.body, { role: "Engineer", company: "Acme", name: "Sara" });
    expect(out).toContain("Engineer position at Acme");
    expect(out).toContain("{target}");
  });
});
