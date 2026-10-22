import { jobPostingFromScripts } from "./jsonld";
import { findSalary, htmlToText, looksRemote, oneLine } from "./text";
import type { ExtractedJob } from "./types";

type Partial4 = Partial<Omit<ExtractedJob, "via">>;

/** A site extractor: selectors for each field, plus a canonical URL for the posting. */
type Site = {
  id: string;
  matches: (url: URL) => boolean;
  title: string[];
  company: string[];
  location: string[];
  description: string[];
  salary?: string[];
  canonical?: (url: URL) => string | null;
};

const SITES: Site[] = [
  {
    id: "linkedin",
    matches: (u) => /(^|\.)linkedin\.com$/.test(u.hostname) && u.pathname.startsWith("/jobs"),
    title: [".job-details-jobs-unified-top-card__job-title h1", ".job-details-jobs-unified-top-card__job-title", ".top-card-layout__title", ".topcard__title", "h1"],
    company: [".job-details-jobs-unified-top-card__company-name a", ".job-details-jobs-unified-top-card__company-name", ".topcard__org-name-link", ".topcard__flavor a"],
    location: [
      ".job-details-jobs-unified-top-card__primary-description-container .tvm__text",
      ".job-details-jobs-unified-top-card__bullet",
      ".topcard__flavor--bullet",
    ],
    description: ["#job-details", ".jobs-description__content", ".jobs-description-content__text", ".show-more-less-html__markup", ".description__text"],
    salary: [".job-details-jobs-unified-top-card__job-insight", ".salary", ".compensation__salary"],
    canonical: (u) => {
      const id = u.searchParams.get("currentJobId") ?? u.pathname.match(/\/jobs\/view\/(?:[^/]*-)?(\d+)/)?.[1];
      return id ? `https://www.linkedin.com/jobs/view/${id}/` : null;
    },
  },
  {
    id: "indeed",
    matches: (u) => /(^|\.)indeed\.[a-z.]+$/.test(u.hostname),
    title: ['[data-testid="jobsearch-JobInfoHeader-title"]', "h1.jobsearch-JobInfoHeader-title", ".jobsearch-JobInfoHeader-title", "h1"],
    company: ['[data-testid="inlineHeader-companyName"]', '[data-company-name="true"]', ".jobsearch-CompanyInfoContainer a", ".jobsearch-InlineCompanyRating > div"],
    location: ['[data-testid="inlineHeader-companyLocation"]', '[data-testid="job-location"]', '[data-testid="jobsearch-JobInfoHeader-companyLocation"]'],
    description: ["#jobDescriptionText", ".jobsearch-jobDescriptionText"],
    salary: ["#salaryInfoAndJobType", '[data-testid="jobsearch-OtherJobDetailsContainer"]', ".salary-snippet-container"],
    canonical: (u) => {
      const jk = u.searchParams.get("vjk") ?? u.searchParams.get("jk");
      return jk ? `${u.origin}/viewjob?jk=${encodeURIComponent(jk)}` : null;
    },
  },
  {
    id: "rozee",
    matches: (u) => /(^|\.)rozee\.pk$/.test(u.hostname),
    title: [".jtitle", "h1.jtitle", ".job-title h1", "h1"],
    company: [".cname a", ".cname", ".company-name", 'a[href*="/company/"]'],
    location: [".jloc", ".job-location", ".location"],
    description: [".jblk", ".job-description", '[itemprop="description"]', ".jdesc"],
    salary: [".jsal", ".salary", ".mrsl"],
  },
  {
    id: "bayt",
    matches: (u) => /(^|\.)bayt\.com$/.test(u.hostname),
    title: ["h1#job_title", "#jobViewJobTitle", "h1"],
    company: ['[data-automation-id="company-name"]', "#jobViewCompanyName", ".job-company-location-wrapper a", 'a[href*="/company/"]'],
    location: ['[data-automation-id="job-location"]', "#jobViewJobLocation", ".job-company-location-wrapper .t-mute"],
    description: ["#job-description", '[itemprop="description"]', ".card-content.is-spaced"],
    salary: ['[data-automation-id="id_salary"]', ".salary"],
  },
];

const first = (doc: Document, selectors: string[], read: (el: Element) => string): string => {
  for (const s of selectors) {
    let el: Element | null = null;
    try {
      el = doc.querySelector(s);
    } catch {
      continue;
    }
    const v = el ? read(el) : "";
    if (v) return v;
  }
  return "";
};

const lineOf = (el: Element) => oneLine(el.textContent);
const blockOf = (el: Element) => htmlToText(el.innerHTML);
const meta = (doc: Document, ...names: string[]) => {
  for (const n of names) {
    const v = doc.querySelector(`meta[property="${n}"], meta[name="${n}"]`)?.getAttribute("content");
    if (v?.trim()) return oneLine(v);
  }
  return "";
};

function fromSite(doc: Document, site: Site): Partial4 {
  return {
    title: first(doc, site.title, lineOf),
    company: first(doc, site.company, lineOf),
    location: first(doc, site.location, lineOf),
    description: first(doc, site.description, blockOf),
    salary: findSalary(first(doc, site.salary ?? [], lineOf)),
  };
}

const merge = (...parts: Partial4[]): Partial4 => {
  const out: Partial4 = {};
  for (const p of parts) {
    for (const [k, v] of Object.entries(p) as [keyof Partial4, string | boolean][]) {
      if (v && !out[k]) (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
};

const isHttpUrl = (s: string) => {
  try {
    return /^https?:$/.test(new URL(s).protocol);
  } catch {
    return false;
  }
};

/** "Senior Engineer - Acme | LinkedIn" → "Senior Engineer - Acme". */
const cleanTitle = (t: string) => oneLine(t.replace(/\s*[|·–-]\s*(LinkedIn|Indeed(\.com)?|Rozee\.pk|Bayt\.com|Bayt)\s*$/i, ""));

/**
 * Reads a job posting from a page: the site's own layout when we know it, then schema.org
 * JobPosting JSON-LD, then Open Graph tags and the page heading. Values are trimmed to the
 * API's limits.
 */
export function extractJob(doc: Document, pageUrl: string): ExtractedJob {
  const url = new URL(pageUrl);
  const site = SITES.find((s) => s.matches(url));
  const scripts = [...doc.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent ?? "");
  const ld = jobPostingFromScripts(scripts);
  const fromLd: Partial4 = ld ? { ...ld, url: isHttpUrl(ld.url) ? ld.url : "" } : {};
  const page: Partial4 = {
    title: meta(doc, "og:title", "twitter:title") || oneLine(doc.querySelector("h1")?.textContent) || oneLine(doc.title),
    description: meta(doc, "og:description", "description"),
  };
  const found = merge(site ? fromSite(doc, site) : {}, fromLd, page);
  const description = found.description ?? "";
  const canonical = site?.canonical?.(url) ?? (fromLd.url || doc.querySelector('link[rel="canonical"]')?.getAttribute("href") || "");
  const title = cleanTitle(found.title ?? "");
  const location = found.location ?? "";
  return {
    title: title.slice(0, 200),
    company: (found.company ?? "").slice(0, 200),
    location: location.slice(0, 200),
    url: (isHttpUrl(canonical) ? canonical : pageUrl).slice(0, 2000),
    description: description.slice(0, 30_000),
    salary: (found.salary || findSalary(description.slice(0, 3000))).slice(0, 120),
    remote: Boolean(ld?.remote) || looksRemote(location, title),
    via: site && fromSite(doc, site).title ? site.id : ld ? "json-ld" : "page",
  };
}
