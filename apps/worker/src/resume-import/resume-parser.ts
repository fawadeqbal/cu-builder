import { ASSISTANT, type Assistant } from "@cvb/ai";
import type { ResumeImportJob } from "@cvb/contracts";
import { emptyCV, isLinkedInExportFile, isLinkedInPdfText, linkedInExportToCv, normalizeCV, parseLinkedInPdfText, parseResumeText, type CV, type ParsedCV } from "@cvb/domain";
import { extractText } from "@cvb/extract";
import { strFromU8, unzipSync } from "fflate";
import { FILE_STORAGE, type FileStorage } from "@cvb/storage";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { UnrecoverableError } from "bullmq";

/** Port: turns an uploaded file into a CV document plus review warnings. */
export interface ResumeParser {
  parse(job: ResumeImportJob): Promise<ParsedCV>;
}

export const RESUME_PARSER = Symbol.for("cvb.worker.ResumeParser");

/** A JSON file: our own backup format (as exported by the editor) or a JSON Resume (jsonresume.org) file. */
export function jsonToCv(raw: string): CV | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (o.personal || o.experience) return normalizeCV(o);
  // JSON Resume schema.
  const basics = (o.basics ?? {}) as Record<string, unknown>;
  if (!o.basics && !o.work) return null;
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  const list = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  const range = (x: Record<string, unknown>) => [s(x.startDate), s(x.endDate) || (x.startDate ? "Present" : "")].filter(Boolean).join(" – ");
  const profiles = list(basics.profiles);
  const profile = (net: string) => s(profiles.find((p) => s(p.network).toLowerCase() === net)?.url);
  const loc = (basics.location ?? {}) as Record<string, unknown>;
  return normalizeCV({
    ...emptyCV,
    personal: {
      ...emptyCV.personal,
      name: s(basics.name),
      headline: s(basics.label),
      email: s(basics.email),
      phone: s(basics.phone),
      website: s(basics.url),
      location: [s(loc.city), s(loc.region), s(loc.countryCode)].filter(Boolean).join(", "),
      linkedin: profile("linkedin"),
      github: profile("github"),
    },
    summary: s(basics.summary),
    experience: list(o.work).map((w) => ({ role: s(w.position), company: s(w.name ?? w.company), location: s(w.location), date: range(w), bullets: [s(w.summary), ...list(w.highlights).map(String)].filter(Boolean), stack: "" })),
    education: list(o.education).map((e) => ({ degree: [s(e.studyType), s(e.area)].filter(Boolean).join(" in "), school: s(e.institution), date: range(e), details: s(e.score) })),
    skills: list(o.skills).map((k) => ({ category: s(k.name) || "Skills", items: list(k.keywords).map(String).join(", ") })),
    projects: list(o.projects).map((p) => ({ name: s(p.name), date: range(p), links: [s(p.url)].filter(Boolean), bullets: [s(p.description), ...list(p.highlights).map(String)].filter(Boolean), stack: list(p.keywords).map(String).join(", ") })),
    certificates: list(o.certificates).map((c) => ({ name: s(c.name), issuer: s(c.issuer), year: s(c.date).slice(0, 4), url: s(c.url) })),
    languages: list(o.languages).map((l) => ({ name: s(l.language), level: s(l.fluency) })),
  });
}

/**
 * Reads the file from storage, extracts its text and turns it into a CV. With an AI provider
 * configured (Ollama or Claude), the AI sorts the text into sections, copying the person's own
 * wording; anything it returns that isn't in the file is dropped, and the rule-based reader fills
 * what it missed. Without AI, or if the AI fails, the rule-based reader does the whole job.
 * JSON backups are read directly.
 */
@Injectable()
export class FileResumeParser implements ResumeParser {
  private readonly logger = new Logger(FileResumeParser.name);

  constructor(
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(ASSISTANT) private readonly ai: Assistant,
  ) {}

  async parse(job: ResumeImportJob): Promise<ParsedCV> {
    const bytes = await this.storage.get(job.fileKey);
    if (job.mimeType === "application/json") {
      const cv = jsonToCv(new TextDecoder().decode(bytes));
      if (!cv) throw new UnrecoverableError("This JSON file isn't a CV backup or a JSON Resume file.");
      return { cv, warnings: [] };
    }
    if (job.mimeType === "application/x-linkedin-export+zip") {
      // A LinkedIn data export: its CSV files map straight onto the CV, no AI needed.
      let parsed: ParsedCV | null;
      try {
        const files = unzipSync(bytes, { filter: (f) => isLinkedInExportFile(f.name) });
        parsed = linkedInExportToCv(Object.fromEntries(Object.entries(files).map(([name, b]) => [name, strFromU8(b)])));
      } catch {
        throw new UnrecoverableError("This ZIP file couldn't be opened. Download your data from LinkedIn again.");
      }
      if (!parsed) throw new UnrecoverableError("This ZIP isn't a LinkedIn data export (it has no Profile.csv).");
      return parsed;
    }
    const text = await this.extract(bytes, job.mimeType);
    if (text.replace(/\s/g, "").length < 40) {
      throw new UnrecoverableError("We couldn't read any text in this file. If it's a scan, export it as a PDF with selectable text or a Word file.");
    }
    // LinkedIn's "Save to PDF" layout has its own reader; it is also the fallback when AI is off or fails.
    const basic = isLinkedInPdfText(text) ? parseLinkedInPdfText(text) : parseResumeText(text);
    if (this.ai.name === "offline") return basic;
    try {
      const { cv } = await this.ai.parseCv({ text });
      const warnings = ["Read with AI. Check each section against your original before you send it."];
      if (!cv.experience.length && !cv.education.length) warnings.push("No jobs or education were found. Add them in the editor.");
      return { cv, warnings };
    } catch (e) {
      this.logger.warn(`AI import failed for ${job.fileName}, using the basic reader: ${e instanceof Error ? e.message : String(e)}`);
      return { cv: basic.cv, warnings: ["AI wasn't available, so a basic import was used. Check the sections carefully.", ...basic.warnings] };
    }
  }

  private async extract(bytes: Uint8Array, mimeType: Exclude<ResumeImportJob["mimeType"], "application/x-linkedin-export+zip" | "application/json">): Promise<string> {
    try {
      return (await extractText(bytes, mimeType)).text;
    } catch {
      throw new UnrecoverableError("This file couldn't be opened. Check it isn't password-protected or damaged.");
    }
  }
}
