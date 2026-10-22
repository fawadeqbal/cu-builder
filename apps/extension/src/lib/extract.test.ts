// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { extractJob } from "./extract";

const page = (html: string) => new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${html}</body></html>`, "text/html");
const withHead = (head: string, body = "") => new DOMParser().parseFromString(`<!doctype html><html><head>${head}</head><body>${body}</body></html>`, "text/html");

describe("extractJob", () => {
  it("reads LinkedIn's job view and uses the canonical posting URL", () => {
    const doc = page(`
      <div class="job-details-jobs-unified-top-card__job-title"><h1>Senior React Developer</h1></div>
      <div class="job-details-jobs-unified-top-card__company-name"><a href="/company/acme">Acme Corp</a></div>
      <div class="job-details-jobs-unified-top-card__primary-description-container"><span class="tvm__text">Lahore, Punjab, Pakistan (Remote)</span></div>
      <div id="job-details"><p>We use React and TypeScript.</p><ul><li>Hooks</li></ul></div>`);
    const job = extractJob(doc, "https://www.linkedin.com/jobs/search/?currentJobId=4012345678&keywords=react");
    expect(job).toMatchObject({
      title: "Senior React Developer",
      company: "Acme Corp",
      location: "Lahore, Punjab, Pakistan (Remote)",
      url: "https://www.linkedin.com/jobs/view/4012345678/",
      remote: true,
      via: "linkedin",
    });
    expect(job.description).toContain("We use React and TypeScript.\n\n- Hooks");
  });

  it("reads Indeed, including the salary line", () => {
    const doc = page(`
      <h1 data-testid="jobsearch-JobInfoHeader-title"><span>Data Analyst - job post</span></h1>
      <div data-testid="inlineHeader-companyName"><a>Beta Ltd</a></div>
      <div data-testid="inlineHeader-companyLocation">Austin, TX</div>
      <div id="salaryInfoAndJobType"><span>$70,000 - $85,000 a year</span> - Full-time</div>
      <div id="jobDescriptionText">SQL and Python.</div>`);
    const job = extractJob(doc, "https://www.indeed.com/jobs?q=analyst&vjk=abc123");
    expect(job).toMatchObject({ title: "Data Analyst - job post", company: "Beta Ltd", location: "Austin, TX", salary: "$70,000 - $85,000 a year", url: "https://www.indeed.com/viewjob?jk=abc123", via: "indeed" });
  });

  it("reads Rozee.pk", () => {
    const doc = page(`<h1 class="jtitle">Accountant</h1><div class="cname"><a>Gamma Traders</a></div><div class="jloc">Karachi, Pakistan</div><div class="jblk">Prepare ledgers. Salary PKR 90,000 - 120,000 per month.</div>`);
    const job = extractJob(doc, "https://www.rozee.pk/gamma-traders-accountant-karachi-jobs-1234567.php");
    expect(job).toMatchObject({ title: "Accountant", company: "Gamma Traders", location: "Karachi, Pakistan", salary: "PKR 90,000 - 120,000 per month", remote: false, via: "rozee" });
  });

  it("fills gaps on Bayt from JSON-LD", () => {
    const ld = { "@type": "JobPosting", title: "Sales Manager", hiringOrganization: { name: "Delta LLC" }, jobLocation: { address: { addressLocality: "Dubai", addressCountry: "AE" } }, description: "<p>Lead the team.</p>" };
    const doc = withHead(`<script type="application/ld+json">${JSON.stringify(ld)}</script>`, `<h1 id="job_title">Sales Manager</h1>`);
    const job = extractJob(doc, "https://www.bayt.com/en/uae/jobs/sales-manager-123/");
    expect(job).toMatchObject({ title: "Sales Manager", company: "Delta LLC", location: "Dubai, AE", description: "Lead the team.", via: "bayt" });
  });

  it("falls back to JSON-LD, then Open Graph, on other sites", () => {
    const ld = { "@context": "https://schema.org", "@graph": [{ "@type": "JobPosting", title: "Nurse", hiringOrganization: "City Hospital", url: "https://careers.city.org/jobs/9", jobLocationType: "TELECOMMUTE" }] };
    const job = extractJob(withHead(`<script type="application/ld+json">${JSON.stringify(ld)}</script>`), "https://careers.city.org/jobs/9?utm=x");
    expect(job).toMatchObject({ title: "Nurse", company: "City Hospital", url: "https://careers.city.org/jobs/9", remote: true, via: "json-ld" });

    const og = extractJob(withHead(`<meta property="og:title" content="Barista | Bean Co"><meta property="og:description" content="Make coffee."><link rel="canonical" href="https://bean.co/jobs/barista">`), "https://bean.co/jobs/barista?ref=1");
    expect(og).toMatchObject({ title: "Barista | Bean Co", description: "Make coffee.", url: "https://bean.co/jobs/barista", via: "page" });
  });
});
