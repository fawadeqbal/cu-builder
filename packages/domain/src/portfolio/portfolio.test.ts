import { describe, expect, it } from "vitest";
import {
  allowedTemplates,
  brandCssVariables,
  brandStylesheet,
  classifyHost,
  contrastRatio,
  dnsPointsAtUs,
  isValidDomain,
  normalizeBranding,
  normalizeDomain,
  readableWithWhite,
  siteSlugProblem,
  suggestSiteSlug,
} from "./index";

describe("site slugs", () => {
  it("accepts DNS-safe names and refuses reserved ones", () => {
    expect(siteSlugProblem("sara-ahmed")).toBeNull();
    expect(siteSlugProblem("ab")).toMatch(/at least/);
    expect(siteSlugProblem("Sara")).toMatch(/lowercase/);
    expect(siteSlugProblem("sara--ahmed")).toMatch(/lowercase/);
    expect(siteSlugProblem("-sara")).toMatch(/lowercase/);
    expect(siteSlugProblem("www")).toMatch(/reserved/);
    expect(siteSlugProblem("a".repeat(41))).toMatch(/40/);
  });

  it("suggests a slug from a name", () => {
    expect(suggestSiteSlug("Sára Ahmed")).toBe("sara-ahmed");
    expect(suggestSiteSlug("Al")).toBe("al-cv");
    expect(suggestSiteSlug("")).toBe("me-cv");
    expect(siteSlugProblem(suggestSiteSlug("Admin"))).toBeNull();
  });
});

describe("domains", () => {
  it("normalises what people paste", () => {
    expect(normalizeDomain(" https://WWW.Example.com:443/about?x=1 ")).toBe("www.example.com");
    expect(normalizeDomain("sara.dev.")).toBe("sara.dev");
  });

  it("validates public host names", () => {
    expect(isValidDomain("sara.dev")).toBe(true);
    expect(isValidDomain("careers.uni.edu.pk")).toBe(true);
    expect(isValidDomain("localhost")).toBe(false);
    expect(isValidDomain("10.0.0.1")).toBe(false);
    expect(isValidDomain("-bad.com")).toBe(false);
    expect(isValidDomain("x.test")).toBe(false);
  });

  it("classifies hosts", () => {
    const opts = { appHosts: ["cvbuilder.pk"], portfolioDomain: "cvbuilder.app" };
    expect(classifyHost("cvbuilder.pk", opts)).toEqual({ kind: "app" });
    expect(classifyHost("www.cvbuilder.pk", opts)).toEqual({ kind: "app" });
    expect(classifyHost("localhost:3000", opts)).toEqual({ kind: "app" });
    expect(classifyHost("sara.cvbuilder.app", opts)).toEqual({ kind: "portfolio", slug: "sara" });
    expect(classifyHost("www.cvbuilder.app", opts)).toEqual({ kind: "app" });
    expect(classifyHost("a.b.cvbuilder.app", opts)).toEqual({ kind: "app" });
    expect(classifyHost("Careers.Uni.edu.pk:443", opts)).toEqual({ kind: "custom", host: "careers.uni.edu.pk" });
    expect(classifyHost("sara.dev", { appHosts: ["cvbuilder.pk"] })).toEqual({ kind: "custom", host: "sara.dev" });
  });

  it("checks DNS points at us by CNAME or A records", () => {
    const target = { host: "sites.cvbuilder.app", ipv4: ["203.0.113.7"] };
    expect(dnsPointsAtUs({ cnames: ["sites.cvbuilder.app."], ipv4: [] }, target)).toBe(true);
    expect(dnsPointsAtUs({ cnames: [], ipv4: ["203.0.113.7"] }, target)).toBe(true);
    expect(dnsPointsAtUs({ cnames: [], ipv4: ["203.0.113.7", "198.51.100.1"] }, target)).toBe(false);
    expect(dnsPointsAtUs({ cnames: [], ipv4: [] }, target)).toBe(false);
  });
});

describe("branding", () => {
  it("checks contrast", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(readableWithWhite("#1e4b8f")).toBe(true);
    expect(readableWithWhite("#ffe066")).toBe(false);
  });

  it("normalises stored branding and derives CSS variables", () => {
    const b = normalizeBranding({ primaryColor: "#0A6", accentColor: "red", logoUrl: "javascript:alert(1)", templateIds: ["modern", 3], hideBrand: "yes" });
    expect(b).toMatchObject({ primaryColor: "#00aa66", accentColor: "", logoUrl: "", templateIds: ["modern"], hideBrand: false });
    expect(brandCssVariables(b)).toMatchObject({ "--brand": "#00aa66", "--brand-hover": "#008b54", "--appbar-bg": "#00aa66" });
    expect(brandStylesheet(b)).toContain('[data-theme="dark"]');
    expect(brandStylesheet(normalizeBranding(null))).toBe("");
    expect(brandCssVariables(normalizeBranding(null))).toEqual({});
  });

  it("restricts templates to the brand's set", () => {
    const all = [{ id: "classic" }, { id: "modern" }, { id: "tech" }];
    expect(allowedTemplates({ templateIds: ["tech", "modern"] }, all).map((t) => t.id)).toEqual(["modern", "tech"]);
    expect(allowedTemplates({ templateIds: [] }, all)).toHaveLength(3);
    expect(allowedTemplates({ templateIds: ["gone"] }, all)).toHaveLength(3);
    expect(allowedTemplates(null, all)).toHaveLength(3);
  });
});
