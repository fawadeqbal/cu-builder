/**
 * Where a visit came from, without personal data: UTM tags, the referring site's domain and the
 * landing path. "First touch" is the first visit on a device; "last touch" is the current session.
 */

export type Touch = {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
  /** Referring domain ("linkedin.com"), never the full URL. */
  referrer?: string;
  /** Normalised landing path ("/cv-examples/:slug" is kept as the real example slug). */
  landing?: string;
};

export const UTM_KEYS = ["source", "medium", "campaign", "term", "content"] as const;

const clip = (v: string | null | undefined, max = 100): string | undefined => {
  const s = (v ?? "").trim().toLowerCase().slice(0, max);
  return s || undefined;
};

/** "https://www.linkedin.com/feed/" → "linkedin.com"; same site, empty or invalid → undefined. */
export function referrerDomain(referrer: string | null | undefined, ownHost?: string): string | undefined {
  if (!referrer) return undefined;
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
    if (!host) return undefined;
    if (ownHost && host === ownHost.toLowerCase().replace(/^www\./, "")) return undefined;
    return host.slice(0, 253);
  } catch {
    return undefined;
  }
}

/** The touch for a page load: UTM tags from the query, the referrer's domain, the landing path. */
export function touchFromUrl(url: string, referrer: string | null | undefined): Touch {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {};
  }
  const touch: Touch = {};
  for (const key of UTM_KEYS) {
    const v = clip(parsed.searchParams.get(`utm_${key}`));
    if (v) touch[key] = v;
  }
  const ref = referrerDomain(referrer, parsed.hostname);
  if (ref) touch.referrer = ref;
  touch.landing = normalisePath(parsed.pathname);
  return touch;
}

/** True when the touch names a campaign or an outside site (a direct visit carries none). */
export const hasAttribution = (t: Touch | undefined): boolean => Boolean(t && (t.source || t.medium || t.campaign || t.referrer));

const SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|yandex|baidu|ecosia|brave|startpage)\./;
const SOCIAL = /(^|\.)(linkedin|lnkd|facebook|fb|instagram|t|twitter|x|reddit|youtube|tiktok|pinterest|whatsapp|wa|telegram|threads|quora)\.(com|co|me|net|org|in)$/;

/** Source and medium for reporting: UTM tags win; else a search engine, social site or other referrer; else direct. */
export function channelOf(t: Touch | undefined): { source: string; medium: string } {
  const ref = t?.referrer;
  if (t?.source) return { source: t.source, medium: t.medium ?? (ref ? "referral" : "(none)") };
  if (ref) {
    const name = ref.replace(/\.(com|co|org|net|io|me|in|pk)(\.[a-z]{2})?$/, "");
    if (SEARCH.test(`${ref}.`) || SEARCH.test(ref)) return { source: name, medium: "organic" };
    if (SOCIAL.test(ref)) return { source: name === "lnkd" ? "linkedin" : name === "t" ? "twitter" : name, medium: "social" };
    return { source: ref, medium: "referral" };
  }
  return { source: "(direct)", medium: t?.medium ?? "(none)" };
}

/**
 * Paths that carry ids or secret slugs are reduced to their route, so share links, CV ids and
 * invite codes never reach analytics. Public content pages (CV examples, tools, templates) keep
 * their slug because which one people land on is the point.
 */
const REDACT: [RegExp, string][] = [
  [/^\/r\/[^/]+/, "/r/:slug"],
  [/^\/l\/[^/]+/, "/l/:slug"],
  [/^\/p\/[^/]+/, "/p/:slug"],
  [/^\/edit\/[^/]+/, "/edit/:id"],
  [/^\/review\/[^/]+/, "/review/:id"],
  [/^\/orders\/[^/]+/, "/orders/:id"],
  [/^\/join\/[^/]+/, "/join/:code"],
  [/^\/org\/(?!new(\/|$))[^/]+/, "/org/:id"],
  [/^\/experts\/[^/]+/, "/experts/:id"],
  [/^\/letters\/[^/]+/, "/letters/:id"],
];

/** The path without query, hash, trailing slash or ids; at most 200 characters. */
export function normalisePath(path: string | null | undefined): string {
  let p = (path ?? "/").split(/[?#]/)[0] ?? "/";
  if (!p.startsWith("/")) p = `/${p}`;
  p = p.replace(/\/{2,}/g, "/");
  if (p.length > 1) p = p.replace(/\/$/, "");
  for (const [re, to] of REDACT) {
    if (re.test(p)) {
      p = p.replace(re, to);
      break;
    }
  }
  // Long opaque segments (cuids, uuids, tokens) anywhere else.
  p = p
    .split("/")
    .map((seg) => (/^[a-z0-9_-]{20,}$/i.test(seg) && /\d/.test(seg) ? ":id" : seg))
    .join("/");
  return p.slice(0, 200);
}

export type PageKind = "home" | "cv_example" | "free_tool" | "template" | "pricing" | "builder" | "app" | "auth" | "other";

/** What sort of page a path is, for landing-page reports. */
export function pageKind(path: string): PageKind {
  if (path === "/" || /^\/(ur|ar)$/.test(path)) return "home";
  if (path.startsWith("/cv-examples")) return "cv_example";
  if (path.startsWith("/tools") || path.startsWith("/ats-checker")) return "free_tool";
  if (path.startsWith("/templates")) return "template";
  if (path.startsWith("/pricing")) return "pricing";
  if (path.startsWith("/builder") || path.startsWith("/new")) return "builder";
  if (/^\/(sign-in|sign-up|forgot-password|reset-password)/.test(path)) return "auth";
  if (/^\/(app|edit|account|jobs|tracker|interview|letters|admin|orders|expert|org|website)/.test(path)) return "app";
  return "other";
}
