import { describe, expect, it } from "vitest";
import { htmlToText, isPrivateAddress, parseJobPage } from "./job-page-reader.js";

describe("job page reader", () => {
  it("reads JSON-LD JobPosting", () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: "Backend Engineer",
      hiringOrganization: { "@type": "Organization", name: "Acme" },
      jobLocation: { "@type": "Place", address: { addressLocality: "Lahore", addressCountry: "PK" } },
      description: "<p>Build APIs with <b>Node.js</b></p><ul><li>PostgreSQL</li></ul>",
    })}</script></head><body></body></html>`;
    const page = parseJobPage(html);
    expect(page).toMatchObject({ title: "Backend Engineer", company: "Acme", location: "Lahore, PK" });
    expect(page.description).toContain("Build APIs with Node.js");
    expect(page.description).toContain("- PostgreSQL");
  });

  it("falls back to the page title and text", () => {
    const page = parseJobPage("<html><head><title>Designer at Foo</title></head><body><main><h1>Designer</h1><p>Figma &amp; research</p></main></body></html>");
    expect(page.title).toBe("Designer at Foo");
    expect(page.description).toContain("Figma & research");
  });

  it("strips scripts and keeps line breaks", () => {
    expect(htmlToText("<p>a</p><script>x()</script><p>b</p>")).toBe("a\nb");
  });

  it("blocks private addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.5", "172.20.0.1", "169.254.169.254", "::1", "fd00::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
  });
});
