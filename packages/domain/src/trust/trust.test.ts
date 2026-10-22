import { describe, expect, it } from "vitest";
import { atsReport } from "../resume/ats";
import { afterExampleCV, beforeExampleCV } from "./examples";
import {
  canModerateTo,
  cleanReview,
  reviewProblem,
  shouldAskForReview,
  statusAfterSave,
  suggestDisplayName,
  REVIEW_TEXT_MAX,
} from "./reviews";
import { publicStats, roundDownForDisplay, showStatsLine, STATS_THRESHOLDS } from "./stats";
import { normalizeWhatsappNumber, whatsappLink } from "./whatsapp";

describe("public stats", () => {
  const raw = { cvsLast7Days: 99, cvsTotal: 999, pdfsLast7Days: null, pdfsTotal: 5 };

  it("withholds every number below its threshold", () => {
    expect(publicStats(raw)).toEqual({ cvsLast7Days: null, cvsTotal: null, pdfsLast7Days: null, pdfsTotal: null });
    expect(showStatsLine(publicStats(raw))).toBe(false);
  });

  it("shows numbers at or over the threshold, rounded down", () => {
    const s = publicStats({ cvsLast7Days: 100, cvsTotal: 12_345, pdfsLast7Days: 157, pdfsTotal: 999 });
    expect(s).toEqual({ cvsLast7Days: 100, cvsTotal: 12_000, pdfsLast7Days: 150, pdfsTotal: null });
    expect(showStatsLine(s)).toBe(true);
  });

  it("needs this week's CVs to pass before any line shows", () => {
    expect(
      showStatsLine(publicStats({ cvsLast7Days: 3, cvsTotal: 50_000, pdfsLast7Days: 500, pdfsTotal: 90_000 })),
    ).toBe(false);
    expect(showStatsLine(null)).toBe(false);
  });

  it("never rounds up", () => {
    for (const n of [0, 9, 99, 101, 999, 1_000, 1_999, 10_050, 123_456])
      expect(roundDownForDisplay(n)).toBeLessThanOrEqual(n);
    expect(roundDownForDisplay(1_240)).toBe(1_200);
    expect(roundDownForDisplay(-5)).toBe(0);
  });

  it("ignores broken counts", () => {
    expect(
      publicStats({ cvsLast7Days: Number.NaN, cvsTotal: Infinity, pdfsLast7Days: null, pdfsTotal: null }).cvsLast7Days,
    ).toBeNull();
    expect(STATS_THRESHOLDS.cvsLast7Days).toBe(100);
  });
});

describe("reviews", () => {
  const good = { rating: 5, text: "Made my CV in one evening.", displayName: "Sara A.", jobTitle: "" };

  it("accepts a normal review", () => {
    expect(reviewProblem(good)).toBeNull();
  });

  it("rejects bad ratings, short or long text, missing names and links", () => {
    expect(reviewProblem({ ...good, rating: 0 })).toMatch(/rating/);
    expect(reviewProblem({ ...good, rating: 6 })).toMatch(/rating/);
    expect(reviewProblem({ ...good, rating: 4.5 })).toMatch(/rating/);
    expect(reviewProblem({ ...good, text: "   ok   " })).toMatch(/at least/);
    expect(reviewProblem({ ...good, text: "a".repeat(REVIEW_TEXT_MAX + 1) })).toMatch(/600/);
    expect(reviewProblem({ ...good, text: "a".repeat(REVIEW_TEXT_MAX) })).toBeNull();
    expect(reviewProblem({ ...good, displayName: "  " })).toMatch(/name/);
    expect(reviewProblem({ ...good, jobTitle: "x".repeat(81) })).toMatch(/job title/);
    expect(reviewProblem({ ...good, text: "Great, see https://spam.example" })).toMatch(/links/);
  });

  it("cleans fields", () => {
    expect(cleanReview({ ...good, text: "  hi there you  ", jobTitle: "  " })).toEqual({
      rating: 5,
      text: "hi there you",
      displayName: "Sara A.",
      jobTitle: null,
    });
  });

  it("sends new and edited reviews back to moderation", () => {
    expect(statusAfterSave(null, good)).toBe("pending");
    const prev = { status: "approved" as const, rating: 5, text: good.text, displayName: "Sara A.", jobTitle: null };
    expect(statusAfterSave(prev, good)).toBe("approved");
    expect(statusAfterSave(prev, { ...good, rating: 4 })).toBe("pending");
    expect(statusAfterSave(prev, { ...good, text: "Changed my mind about it." })).toBe("pending");
    expect(statusAfterSave({ ...prev, status: "rejected" }, good)).toBe("rejected");
  });

  it("moderates to approved or rejected only", () => {
    expect(canModerateTo("approved")).toBe(true);
    expect(canModerateTo("rejected")).toBe(true);
    expect(canModerateTo("pending")).toBe(false);
  });

  it("suggests a first name and initial", () => {
    expect(suggestDisplayName("Sara Ahmed")).toBe("Sara A.");
    expect(suggestDisplayName("  Muhammad Ali Khan ")).toBe("Muhammad K.");
    expect(suggestDisplayName("Bilal")).toBe("Bilal");
    expect(suggestDisplayName("")).toBe("");
    expect(suggestDisplayName("فاطمہ علی")).toBe("فاطمہ ع.");
  });

  it("asks once, and not after a review exists", () => {
    expect(shouldAskForReview({ alreadyAsked: false, hasReview: false })).toBe(true);
    expect(shouldAskForReview({ alreadyAsked: true, hasReview: false })).toBe(false);
    expect(shouldAskForReview({ alreadyAsked: false, hasReview: true })).toBe(false);
  });
});

describe("whatsapp", () => {
  it("normalises international numbers", () => {
    expect(normalizeWhatsappNumber("+92 300 1234567")).toBe("923001234567");
    expect(normalizeWhatsappNumber("0092-300-1234567")).toBe("923001234567");
    expect(normalizeWhatsappNumber("(971) 50 123 4567")).toBe("971501234567");
  });

  it("refuses things that aren't international numbers", () => {
    expect(normalizeWhatsappNumber("")).toBeNull();
    expect(normalizeWhatsappNumber("03001234567")).toBeNull();
    expect(normalizeWhatsappNumber("12345")).toBeNull();
    expect(normalizeWhatsappNumber("+92 300 CALL ME")).toBeNull();
    expect(normalizeWhatsappNumber("1".repeat(16))).toBeNull();
  });

  it("builds a wa.me link with the message", () => {
    expect(whatsappLink("+92 300 1234567")).toBe("https://wa.me/923001234567");
    expect(whatsappLink("923001234567", "Hi, I need help with my CV")).toBe(
      "https://wa.me/923001234567?text=Hi%2C%20I%20need%20help%20with%20my%20CV",
    );
    expect(whatsappLink("nope", "hi")).toBeNull();
  });
});

describe("before and after examples", () => {
  it("score clearly apart on the real ATS check", () => {
    const before = atsReport(beforeExampleCV, { templateAts: true, pages: 1 });
    const after = atsReport(afterExampleCV, { templateAts: true, pages: 1 });
    expect(before.score).toBeLessThan(60);
    expect(after.score).toBeGreaterThanOrEqual(85);
    expect(after.issues.filter((i) => i.severity === "high")).toEqual([]);
  });
});
