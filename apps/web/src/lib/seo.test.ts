import { afterEach, describe, expect, it, vi } from "vitest";
import { absoluteUrl, faqPageJsonLd, landingJsonLd, serializeJsonLd, siteUrl, webApplicationJsonLd } from "./seo";

afterEach(() => vi.unstubAllEnvs());

describe("siteUrl", () => {
  it("uses APP_URL without a trailing slash", () => {
    vi.stubEnv("APP_URL", "https://cv.example.com/");
    expect(siteUrl()).toBe("https://cv.example.com");
    expect(absoluteUrl("/ats-checker")).toBe("https://cv.example.com/ats-checker");
  });

  it("falls back to NEXT_PUBLIC_APP_URL, then localhost", () => {
    vi.stubEnv("APP_URL", "not a url");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://public.example.com");
    expect(siteUrl()).toBe("https://public.example.com");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(siteUrl()).toBe("http://localhost:3000");
  });
});

describe("JSON-LD", () => {
  it("builds FAQPage and WebApplication data without ratings", () => {
    const faq = faqPageJsonLd([{ q: "Is it free?", a: "Yes." }]);
    expect(faq).toMatchObject({ "@type": "FAQPage", mainEntity: [{ "@type": "Question", name: "Is it free?", acceptedAnswer: { text: "Yes." } }] });
    const app = webApplicationJsonLd({ name: "ATS checker", description: "d", path: "/ats-checker" }, "https://cv.example.com");
    expect(app).toMatchObject({ "@type": "WebApplication", url: "https://cv.example.com/ats-checker", offers: { price: "0" } });
    const landing = landingJsonLd([{ q: "q", a: "a" }], "https://cv.example.com");
    expect(landing.map((x) => x["@type"])).toEqual(["SoftwareApplication", "FAQPage"]);
    expect(JSON.stringify(landing)).not.toMatch(/"(aggregateRating|review)"/);
  });

  it("can't be broken out of its script tag", () => {
    expect(serializeJsonLd({ text: "</script><script>alert(1)</script>" })).not.toContain("</script>");
  });
});
