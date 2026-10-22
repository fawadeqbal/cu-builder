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

  it("renders the job search emails", () => {
    const r = renderEmail(
      { template: "reminders", to: "a@b.co", name: "Sara", items: [{ title: "Follow up: Acme", dueAt: "2026-10-22T09:00:00.000Z" }] },
      "https://app.test",
    );
    expect(r.subject).toBe("Reminder: Follow up: Acme");
    expect(r.text).toContain("https://app.test/tracker");

    const d = renderEmail(
      { template: "weekly-digest", to: "a@b.co", name: "Sara", stats: { added: 3, applied: 2, interviews: 1, offers: 0, total: 6 }, upcoming: [] },
      "https://app.test",
    );
    expect(d.text).toContain("3 saved, 2 applied, 1 interviews");

    const a = renderEmail(
      { template: "job-alert", to: "a@b.co", name: "Sara", jobs: [{ title: "React dev", company: "Acme", location: "Remote", url: "https://j.test/1", score: 82 }] },
      "https://app.test",
    );
    expect(a.html).toContain("82% match");
  });

  it("renders a recruiter's message with a reply button and without the candidate's address", () => {
    const r = renderEmail(
      {
        template: "talent-contact",
        to: "ayesha@example.com",
        name: "Ayesha",
        recruiterName: "Bilal",
        orgName: "Hire & Co",
        message: "Hi Ayesha,\n\nWe have a React role in Lahore.",
        replyTo: "bilal@hire.example",
      },
      "https://app.test",
    );
    expect(r.subject).toBe("Bilal from Hire & Co would like to talk");
    expect(r.html).toContain("mailto:bilal@hire.example?subject=Re%3A%20Bilal%20from%20Hire%20%26%20Co");
    expect(r.html).toContain("Hire &#38; Co");
    expect(r.text).toContain("We have a React role in Lahore.");
    expect(r.text).toContain("https://app.test/account#talent");
  });
});
