/**
 * Search-engine helpers: the public URL of the site and schema.org JSON-LD for public pages.
 * Server-side only for `siteUrl()` (APP_URL is a server environment variable, read at request
 * time, so one image can serve any domain).
 */

export const SITE_NAME = "CV Builder";

/**
 * The public origin of the web app, e.g. https://cvbuilder.example.com. The web container gets
 * APP_URL (the same variable the API uses; see infra/docker-compose.prod.yml). NEXT_PUBLIC_APP_URL
 * is accepted too. Falls back to localhost in development.
 */
export function siteUrl(): string {
  for (const v of [process.env.APP_URL, process.env.NEXT_PUBLIC_APP_URL]) {
    if (!v?.trim()) continue;
    try {
      const url = new URL(v.trim());
      return url.origin + url.pathname.replace(/\/+$/, "");
    } catch {
      // ignore a malformed value
    }
  }
  return "http://localhost:3000";
}

/** An absolute URL on this site. */
export const absoluteUrl = (path: string, base: string = siteUrl()) => `${base}${path.startsWith("/") ? path : `/${path}`}`;

export type FaqItem = { q: string; a: string };
export type JsonLdObject = Record<string, unknown>;

/** The free plan, as structured data (we never publish ratings or reviews we don't have). */
const FREE_OFFER = { "@type": "Offer", price: "0", priceCurrency: "USD" } as const;

export function faqPageJsonLd(faq: FaqItem[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

/** A free tool page (ATS checker, AI writing tools). */
export function webApplicationJsonLd(tool: { name: string; description: string; path: string }, base: string = siteUrl()): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: tool.name,
    description: tool.description,
    url: absoluteUrl(tool.path, base),
    applicationCategory: "BusinessApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript",
    isAccessibleForFree: true,
    offers: FREE_OFFER,
    publisher: { "@type": "Organization", name: SITE_NAME, url: base },
  };
}

/**
 * For the landing page (/): the product as a SoftwareApplication plus its FAQ. Render it from
 * the server page (app/page.tsx) with `<JsonLd data={landingJsonLd(FAQ)} />`, passing the same
 * questions the page shows (Google wants FAQ structured data to match visible text).
 */
export function landingJsonLd(faq: FaqItem[], base: string = siteUrl()): JsonLdObject[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      url: base,
      description: "Write your CV step by step with a live preview, an ATS check and honest AI help. Import your old CV, tailor it to each job and download a free PDF.",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Any",
      inLanguage: ["en", "ur", "ar"],
      offers: FREE_OFFER,
    },
    faqPageJsonLd(faq),
  ];
}

/** JSON for a `<script type="application/ld+json">`, with `<` escaped so text can't close the tag. */
export const serializeJsonLd = (data: JsonLdObject | JsonLdObject[]) => JSON.stringify(data).replace(/</g, "\\u003c");
