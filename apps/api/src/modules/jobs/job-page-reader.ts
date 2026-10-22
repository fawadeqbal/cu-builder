import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { UpstreamError, ValidationError } from "@cvb/shared";
import { Injectable } from "@nestjs/common";

export type JobPage = { title: string; company: string; location: string; description: string };

/** Port: reads a job posting from a link. */
export interface JobPageReader {
  read(url: string): Promise<JobPage>;
}
export const JOB_PAGE_READER = Symbol.for("cvb.api.JobPageReader");

const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 8_000;

/** Private, loopback, link-local and metadata addresses must never be fetched (SSRF). */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    const mapped = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]!) : false;
  }
  const [a, b] = ip.split(".").map(Number) as [number, number];
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)));

/** HTML → readable text with line breaks at block elements. */
export function htmlToText(html: string): string {
  return decode(
    html
      .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|tr|section|ul|ol)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n[\s]*/g, "\n")
    .trim();
}

/** Reads schema.org JobPosting JSON-LD, which most job boards and career sites publish. */
export function parseJobPage(html: string): JobPage {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data: unknown = JSON.parse(m[1]!.trim());
      const nodes = (Array.isArray(data) ? data : [data, ...(((data as { "@graph"?: unknown[] })["@graph"]) ?? [])]) as Record<string, unknown>[];
      const job = nodes.find((n) => n && (n["@type"] === "JobPosting" || (Array.isArray(n["@type"]) && (n["@type"] as string[]).includes("JobPosting"))));
      if (job) {
        const org = job.hiringOrganization as { name?: string } | undefined;
        const loc = (Array.isArray(job.jobLocation) ? job.jobLocation[0] : job.jobLocation) as { address?: Record<string, string> } | undefined;
        const address = loc?.address ?? {};
        return {
          title: String(job.title ?? "").trim(),
          company: String(org?.name ?? "").trim(),
          location: [address.addressLocality, address.addressCountry].filter(Boolean).join(", ") || (job.jobLocationType === "TELECOMMUTE" ? "Remote" : ""),
          description: htmlToText(decode(String(job.description ?? ""))).slice(0, 30_000),
        };
      }
    } catch {
      // Malformed JSON-LD: try the next block, then fall back to the page text.
    }
  }
  const og = (p: string) => html.match(new RegExp(`<meta[^>]+property=["']og:${p}["'][^>]+content=["']([^"']+)`, "i"))?.[1];
  const title = decode(og("title") ?? html.match(/<title[^>]*>([^<]+)/i)?.[1] ?? "").trim();
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html.match(/<body[\s\S]*<\/body>/i)?.[0] ?? html;
  return { title, company: decode(og("site_name") ?? "").trim(), location: "", description: htmlToText(main).slice(0, 30_000) };
}

@Injectable()
export class HttpJobPageReader implements JobPageReader {
  async read(raw: string): Promise<JobPage> {
    let url = new URL(raw);
    for (let hop = 0; hop < 4; hop++) {
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new ValidationError("Only web links can be read");
      const host = url.hostname;
      const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
      if (!addresses.length) throw new ValidationError("That website couldn't be found");
      if (addresses.some((a) => isPrivateAddress(a.address))) throw new ValidationError("That address can't be read");

      const res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "user-agent": "Mozilla/5.0 (compatible; CVBuilderBot/1.0; +job-link-reader)", accept: "text/html,application/xhtml+xml" },
      }).catch(() => {
        throw new UpstreamError("We couldn't reach that page. Paste the job description instead.");
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        url = new URL(res.headers.get("location")!, url);
        continue;
      }
      if (!res.ok) throw new UpstreamError(`The page answered with ${res.status}. Paste the job description instead.`);
      const reader = res.body?.getReader();
      if (!reader) throw new UpstreamError("The page was empty");
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) {
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
      const page = parseJobPage(new TextDecoder().decode(Buffer.concat(chunks)));
      if (page.description.length < 80) throw new UpstreamError("We couldn't find the job description on that page. Paste it instead.");
      return page;
    }
    throw new UpstreamError("Too many redirects");
  }
}
