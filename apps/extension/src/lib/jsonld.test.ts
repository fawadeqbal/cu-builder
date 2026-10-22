import { describe, expect, it } from "vitest";
import { findJobPostings, fromJobPosting, jobPostingFromScripts } from "./jsonld";

const posting = {
  "@context": "https://schema.org",
  "@type": "JobPosting",
  title: "Senior Frontend Engineer",
  description: "<p>Build things with <b>React</b> &amp; TypeScript.</p><ul><li>5+ years</li><li>Testing</li></ul>",
  hiringOrganization: { "@type": "Organization", name: "Acme" },
  jobLocation: [{ "@type": "Place", address: { addressLocality: "Lahore", addressRegion: "Punjab", addressCountry: { name: "Pakistan" } } }],
  baseSalary: { "@type": "MonetaryAmount", currency: "PKR", value: { "@type": "QuantitativeValue", minValue: 300000, maxValue: 450000, unitText: "MONTH" } },
  url: "https://jobs.example.com/123",
};

describe("JSON-LD job postings", () => {
  it("finds postings at the top level, in arrays and in @graph", () => {
    expect(findJobPostings(posting)).toHaveLength(1);
    expect(findJobPostings([{ "@type": "WebPage" }, posting])).toHaveLength(1);
    expect(findJobPostings({ "@graph": [{ "@type": "Organization" }, { ...posting, "@type": ["JobPosting"] }] })).toHaveLength(1);
    expect(findJobPostings({ "@type": "Article" })).toHaveLength(0);
  });

  it("maps the fields we save", () => {
    const job = fromJobPosting(posting);
    expect(job).toMatchObject({ title: "Senior Frontend Engineer", company: "Acme", location: "Lahore, Punjab, Pakistan", salary: "PKR 300k–450k per month", remote: false });
    expect(job.description).toBe("Build things with React & TypeScript.\n\n- 5+ years\n- Testing");
  });

  it("marks telecommute postings remote and skips broken JSON", () => {
    const job = jobPostingFromScripts([
      "{ not json",
      JSON.stringify({ "@type": "JobPosting", title: "Support Agent", hiringOrganization: "Beta", jobLocationType: "TELECOMMUTE", applicantLocationRequirements: { "@type": "Country", name: "UAE" } }),
    ]);
    expect(job).toMatchObject({ title: "Support Agent", company: "Beta", remote: true, location: "Remote, UAE" });
  });
});
