import { htmlToText, oneLine } from "./text";

/** The fields a schema.org JobPosting gives us. */
export type JobPostingFields = { title: string; company: string; location: string; description: string; salary: string; remote: boolean; url: string };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null ? [] : [v]);

const isJobPosting = (o: Obj) => list(o["@type"]).some((t) => str(t).toLowerCase() === "jobposting");

/** Finds every JobPosting in parsed JSON-LD (top level, arrays, @graph). */
export function findJobPostings(data: unknown, depth = 0): Obj[] {
  if (depth > 5) return [];
  if (Array.isArray(data)) return data.flatMap((d) => findJobPostings(d, depth + 1));
  if (!isObj(data)) return [];
  if (isJobPosting(data)) return [data];
  return [...list(data["@graph"]), ...list(data.mainEntity)].flatMap((d) => findJobPostings(d, depth + 1));
}

const placeName = (v: unknown): string => {
  if (typeof v === "string") return v;
  if (!isObj(v)) return "";
  const address = v.address;
  if (typeof address === "string") return address;
  if (isObj(address)) {
    const country = isObj(address.addressCountry) ? str(address.addressCountry.name) : str(address.addressCountry);
    return [str(address.addressLocality), str(address.addressRegion), country].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(", ");
  }
  return str(v.name);
};

const short = (n: number) => (n >= 1000 ? `${Math.round(n / 100) / 10}k`.replace(".0k", "k") : String(n));

function salaryText(v: unknown): string {
  if (!isObj(v)) return str(v);
  const currency = str(v.currency);
  const value = v.value;
  if (!isObj(value)) return oneLine(`${currency} ${str(value)}`);
  const min = Number(value.minValue ?? value.value);
  const max = Number(value.maxValue ?? NaN);
  const unit = str(value.unitText).toLowerCase();
  if (!Number.isFinite(min)) return "";
  const range = Number.isFinite(max) && max !== min ? `${short(min)}–${short(max)}` : short(min);
  return oneLine(`${currency} ${range}${unit ? ` per ${unit}` : ""}`);
}

/** Maps a JobPosting object to our job fields. */
export function fromJobPosting(o: Obj): JobPostingFields {
  const org = o.hiringOrganization;
  const company = isObj(org) ? str(org.name) : str(org);
  const locations = list(o.jobLocation).map(placeName).filter(Boolean);
  const remote = list(o.jobLocationType).some((t) => /telecommute/i.test(str(t)));
  const applicantLocation = list(o.applicantLocationRequirements).map(placeName).filter(Boolean);
  return {
    title: oneLine(htmlToText(str(o.title))),
    company: oneLine(company),
    location: oneLine([...new Set(locations)].join(" · ") || (remote ? ["Remote", ...applicantLocation].join(", ") : "")),
    description: htmlToText(str(o.description)),
    salary: salaryText(o.baseSalary ?? o.estimatedSalary),
    remote,
    url: str(o.url),
  };
}

/** The first JobPosting on a page from its `<script type="application/ld+json">` blocks. */
export function jobPostingFromScripts(scripts: string[]): JobPostingFields | null {
  for (const raw of scripts) {
    try {
      const found = findJobPostings(JSON.parse(raw.trim()));
      if (found[0]) return fromJobPosting(found[0]);
    } catch {
      // Malformed JSON-LD is common; skip it.
    }
  }
  return null;
}
