/**
 * Portfolio site addresses: <slug>.<PORTFOLIO_DOMAIN>. Slugs are DNS labels, so the same
 * rules apply: lowercase letters, digits and single dashes, 3–40 characters.
 */

/** Names that would collide with our own hosts or look official. */
export const RESERVED_SLUGS = new Set([
  "www", "app", "api", "admin", "mail", "smtp", "imap", "pop", "ftp", "cdn", "static", "assets", "img", "images",
  "blog", "help", "support", "docs", "status", "dashboard", "login", "signin", "signup", "register", "account",
  "billing", "pay", "payments", "checkout", "secure", "auth", "oauth", "sso", "id", "dev", "staging", "test",
  "demo", "beta", "preview", "domains", "sites", "site", "portfolio", "cv", "cvbuilder", "resume", "jobs",
  "careers", "about", "contact", "legal", "privacy", "terms", "security", "abuse", "postmaster", "hostmaster",
  "webmaster", "root", "system", "official", "team", "news",
]);

const SLUG = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){1,38}[a-z0-9]$/;

/** Why a slug can't be used, or null when it's fine. */
export function siteSlugProblem(slug: string): string | null {
  if (slug.length < 3) return "Use at least 3 characters";
  if (slug.length > 40) return "Use 40 characters or fewer";
  if (!SLUG.test(slug)) return "Use lowercase letters, numbers and single dashes";
  if (RESERVED_SLUGS.has(slug)) return "That address is reserved";
  return null;
}

/** A slug suggestion from a name: "Sara Ahmed" → "sara-ahmed". */
export function suggestSiteSlug(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36)
    .replace(/-+$/g, "");
  const slug = base.length >= 3 ? base : `${base || "me"}-cv`;
  return RESERVED_SLUGS.has(slug) ? `${slug}-cv` : slug;
}
