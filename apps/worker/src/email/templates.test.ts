import { describe, expect, it } from "vitest";
import { renderEmail } from "./templates.js";

describe("renderEmail", () => {
  it("renders every template with a subject, text and escaped html", () => {
    const r = renderEmail({ template: "verify-email", to: "a@b.co", name: "<Sara>", url: "https://x.test/v?t=1" }, "https://app.test");
    expect(r.subject).toBe("Confirm your email");
    expect(r.text).toContain("https://x.test/v?t=1");
    expect(r.html).toContain("&#60;Sara&#62;");
    expect(r.html).not.toContain("<Sara>");

    const receipt = renderEmail(
      { template: "receipt", to: "a@b.co", name: "Sara", description: "Premium pass, 7 days", amountCents: 900, currency: "USD" },
      "https://app.test",
    );
    expect(receipt.text).toContain("$9.00");
  });
});
