import type { MetadataRoute } from "next";
import { absoluteUrl, siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

/**
 * Signed-in and per-user areas search engines shouldn't crawl. Rules are prefixes, so "/expert$"
 * (the expert's own dashboard) is anchored to keep the public /experts directory crawlable.
 */
const PRIVATE_PATHS = ["/app", "/edit/", "/account", "/admin", "/org", "/orders", "/expert$", "/review/", "/api/", "/new", "/jobs", "/tracker", "/interview", "/letters", "/website", "/join/", "/sign-in", "/sign-up", "/forgot-password", "/reset-password"];

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE_PATHS }],
    sitemap: absoluteUrl("/sitemap.xml", base),
    host: base,
  };
}
