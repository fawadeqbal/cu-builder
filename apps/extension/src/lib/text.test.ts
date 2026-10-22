import { describe, expect, it } from "vitest";
import { decodeEntities, findSalary, htmlToText, looksRemote } from "./text";

describe("text helpers", () => {
  it("turns HTML into readable text", () => {
    expect(htmlToText("<h2>About</h2><p>We&#39;re hiring&nbsp;now.</p><script>x()</script><br>Thanks")).toBe("About\nWe're hiring now.\n\nThanks");
    expect(decodeEntities("&#x41;&lt;&gt;&unknown;")).toBe("A<>&unknown;");
  });

  it("finds salary figures", () => {
    expect(findSalary("Pay: $120,000 - $150,000 a year, plus equity")).toBe("$120,000 - $150,000 a year");
    expect(findSalary("Salary PKR 150,000 – 200,000 per month")).toBe("PKR 150,000 – 200,000 per month");
    expect(findSalary("AED 15k/month")).toBe("AED 15k/month");
    expect(findSalary("5+ years of experience")).toBe("");
  });

  it("spots remote jobs", () => {
    expect(looksRemote("Remote (EU)")).toBe(true);
    expect(looksRemote("Karachi, Pakistan", "Engineer")).toBe(false);
  });
});
