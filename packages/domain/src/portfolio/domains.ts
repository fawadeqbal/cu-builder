/**
 * Hosts and custom domains: normalising what people type, validating it, and deciding what a
 * request's Host header points at (the app, a portfolio sub-domain or a custom domain).
 */

/** "https://WWW.Example.com:443/path" → "www.example.com". Returns "" for nothing usable. */
export function normalizeDomain(input: string): string {
  let d = input.trim().toLowerCase();
  d = d.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  d = d.split(/[/?#]/)[0] ?? "";
  d = d.replace(/^[^@]*@/, "");
  d = d.replace(/:\d+$/, "");
  d = d.replace(/\.+$/, "");
  return d;
}

const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

/** A public, multi-label host name (no IPs, no localhost, no wildcards). */
export function isValidDomain(domain: string): boolean {
  if (!domain || domain.length > 253) return false;
  const labels = domain.split(".");
  if (labels.length < 2) return false;
  if (!labels.every((l) => LABEL.test(l))) return false;
  const tld = labels.at(-1)!;
  if (/^\d+$/.test(tld)) return false; // an IPv4 address
  return !["localhost", "local", "internal", "test", "invalid", "example"].includes(tld);
}

/** True when `host` is `parent` itself or one of its sub-domains. */
export const isSameOrSubdomain = (host: string, parent: string) => host === parent || host.endsWith(`.${parent}`);

export type HostKind =
  /** Our own app (or anything we can't classify safely, e.g. localhost in development). */
  | { kind: "app" }
  /** <slug>.<portfolio domain>. */
  | { kind: "portfolio"; slug: string }
  /** Someone's own domain: a portfolio or a white-label partner (looked up by the server). */
  | { kind: "custom"; host: string };

/**
 * What a request's Host header points at. `appHosts` are the app's own host names (from
 * APP_URL); `portfolioDomain` is the parent of portfolio sub-domains, if configured.
 */
export function classifyHost(rawHost: string, opts: { appHosts: string[]; portfolioDomain?: string | null }): HostKind {
  const host = normalizeDomain(rawHost);
  if (!host || !isValidDomain(host)) return { kind: "app" };
  const apps = opts.appHosts.map(normalizeDomain).filter(Boolean);
  if (apps.some((a) => host === a || host === `www.${a}`)) return { kind: "app" };
  const parent = opts.portfolioDomain ? normalizeDomain(opts.portfolioDomain) : "";
  if (parent && host !== parent && host.endsWith(`.${parent}`)) {
    const sub = host.slice(0, -(parent.length + 1));
    if (!sub.includes(".") && sub !== "www") return { kind: "portfolio", slug: sub };
    return { kind: "app" };
  }
  if (parent && (host === parent || host === `www.${parent}`)) return { kind: "app" };
  return { kind: "custom", host };
}

export type DnsRecords = { cnames: string[]; ipv4: string[] };

/**
 * Whether DNS points `domain` at us: a CNAME to the target host, or A records that match the
 * server's addresses (given, or the target's own A records).
 */
export function dnsPointsAtUs(records: DnsRecords, target: { host: string; ipv4: string[] }): boolean {
  const t = normalizeDomain(target.host);
  if (t && records.cnames.map(normalizeDomain).some((c) => c === t)) return true;
  const ours = new Set(target.ipv4);
  return records.ipv4.length > 0 && records.ipv4.every((ip) => ours.has(ip));
}
