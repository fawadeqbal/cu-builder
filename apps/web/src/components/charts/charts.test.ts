import { describe, expect, it } from "vitest";
import { cohortStep } from "./CohortHeatmap";
import { toCsv } from "./csv";
import { formatBucket, formatChange, formatCount, formatMoney, inkOn, niceTicks } from "./format";

describe("chart helpers", () => {
  it("makes clean axis ticks from zero", () => {
    expect(niceTicks(0, 87)).toEqual([0, 25, 50, 75, 100]);
    expect(niceTicks(0, 0)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(niceTicks(0, 3)).toEqual([0, 1, 2, 3]);
    expect(niceTicks(0, 1, 4, true)).toEqual([0, 1]);
    expect(niceTicks(0, 9, 4, true)).toEqual([0, 5, 10]);
    expect(niceTicks(-300, 1200)[0]).toBeLessThanOrEqual(-300);
  });

  it("formats counts, money, changes and buckets", () => {
    expect(formatCount(1284)).toBe("1,284");
    expect(formatCount(12_900)).toBe("12.9K");
    expect(formatMoney(150_000, "usd")).toBe("$1,500");
    expect(formatMoney(1950, "usd")).toBe("$19.5");
    expect(formatMoney(9_900_000, "pkr", true)).toBe("Rs 99K");
    expect(formatChange(0.125)).toBe("+12.5%");
    expect(formatChange(-0.03)).toBe("−3%");
    expect(formatChange(null)).toBeNull();
    expect(formatBucket("2026-10-23")).toBe("23 Oct");
    expect(formatBucket("2026-10")).toBe("Oct 2026");
  });

  it("picks readable ink on fills and steps for retention", () => {
    expect(inkOn("#cde2fb")).toBe("#1a1a1a");
    expect(inkOn("#0d366b")).toBe("#ffffff");
    expect([0, 0.01, 0.5, 1].map(cohortStep)).toEqual([0, 1, 4, 7]);
  });

  it("writes CSV safely", () => {
    const csv = toCsv([{ a: 'He said "hi", ok', b: 3 }, { a: "=HYPERLINK()", b: -2 }], [
      { label: "Text", value: (r) => r.a },
      { label: "N", value: (r) => r.b },
    ]);
    expect(csv).toBe('Text,N\r\n"He said ""hi"", ok",3\r\n\'=HYPERLINK(),-2');
  });
});
