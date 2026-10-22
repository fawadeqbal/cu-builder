import type { MetadataRoute } from "next";
import { EXAMPLES, examplePath } from "@/lib/examples";
import { absoluteUrl, siteUrl } from "@/lib/seo";

// Built per request so the URLs use this deployment's APP_URL (the Docker image serves any domain).
export const dynamic = "force-dynamic";

/** Public pages for search engines. Signed-in areas are left out (and disallowed in robots.ts). */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const page = (path: string, priority: number, changeFrequency: "weekly" | "monthly" = "monthly") => ({ url: absoluteUrl(path, base), changeFrequency, priority });
  return [
    page("/", 1, "weekly"),
    page("/builder", 0.9),
    page("/ats-checker", 0.9),
    page("/templates", 0.8, "weekly"),
    page("/cv-examples", 0.8),
    page("/tools", 0.7),
    page("/tools/summary-generator", 0.7),
    page("/tools/bullet-improver", 0.7),
    page("/pricing", 0.6),
    page("/experts", 0.6, "weekly"),
    ...EXAMPLES.map((e) => page(examplePath(e.slug), 0.7)),
  ];
}
