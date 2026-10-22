import { classifyHost } from "@cvb/domain";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Host routing. The app's own host passes straight through. Portfolio sites live at
 * <slug>.<PORTFOLIO_DOMAIN> and on verified custom domains: their home page is /p/<slug>.
 * A white-label partner's domain serves the normal app (BrandingProvider restyles it).
 */

const API = process.env.API_INTERNAL_URL ?? "http://localhost:4000";
const CACHE_MS = 60_000;
type Target = { kind: "portfolio"; slug: string } | { kind: "org"; orgId: string } | { kind: "none" };
const cache = new Map<string, { at: number; target: Target }>();

function appHosts(): string[] {
  const out = ["localhost"];
  for (const v of [process.env.APP_URL, process.env.NEXT_PUBLIC_APP_URL]) {
    try {
      if (v) out.push(new URL(v).hostname);
    } catch {
      // ignore a malformed value
    }
  }
  return out;
}

/** What a custom host serves, asked of the API and remembered for a minute. */
async function lookup(host: string): Promise<Target> {
  const hit = cache.get(host);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.target;
  let target: Target = { kind: "none" };
  try {
    const res = await fetch(`${API}/api/v1/public/domains/resolve?host=${encodeURIComponent(host)}`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) target = (await res.json()) as Target;
  } catch {
    // API unreachable: serve the app rather than fail the request.
  }
  if (cache.size > 1000) cache.clear();
  cache.set(host, { at: Date.now(), target });
  return target;
}

function site(req: NextRequest, slug: string) {
  const { pathname } = req.nextUrl;
  if (pathname === "/") return NextResponse.rewrite(new URL(`/p/${slug}`, req.url));
  if (pathname === `/p/${slug}`) return NextResponse.next();
  // Everything else on a portfolio host goes back to the site's home page.
  return NextResponse.redirect(new URL("/", req.url));
}

export async function proxy(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const kind = classifyHost(host, { appHosts: appHosts(), portfolioDomain: process.env.PORTFOLIO_DOMAIN });
  if (kind.kind === "app") return NextResponse.next();
  if (kind.kind === "portfolio") return site(req, kind.slug);
  const target = await lookup(kind.host);
  return target.kind === "portfolio" ? site(req, target.slug) : NextResponse.next();
}

export const config = {
  // Not for assets, Next internals or the API (Caddy and the rewrite send /api to the API).
  matcher: ["/((?!api/|_next/|favicon.ico|robots.txt|sitemap.xml).*)"],
};
