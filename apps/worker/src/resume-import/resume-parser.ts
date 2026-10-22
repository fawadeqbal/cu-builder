import { ASSISTANT, type Assistant } from "@cvb/ai";
import type { ResumeImportJob } from "@cvb/contracts";
import { emptyCV, normalizeCV, parseResumeText, type CV, type ParsedCV } from "@cvb/domain";
import { FILE_STORAGE, type FileStorage } from "@cvb/storage";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { UnrecoverableError } from "bullmq";
import { strFromU8, unzipSync } from "fflate";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

/** Port: turns an uploaded file into a CV document plus review warnings. */
export interface ResumeParser {
  parse(job: ResumeImportJob): Promise<ParsedCV>;
}

export const RESUME_PARSER = Symbol.for("cvb.worker.ResumeParser");

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)));

/** HTML (or OpenDocument XML) to text with line breaks at blocks and list items. */
export function markupToText(markup: string): string {
  return decode(
    markup
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<text:line-break\/>/gi, "\n")
      .replace(/<li[^>]*>|<text:list-item[^>]*>/gi, "\n- ")
      .replace(/<\/(p|div|h[1-6]|li|tr|section|header)>|<\/text:(p|h)>/gi, "\n")
      .replace(/<text:tab\/>/gi, "\t")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Windows-1252 characters 0x80–0x9F (curly quotes, dashes, bullet…); the rest map to Latin-1. */
const CP1252 = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008DŽ\u008F\u0090‘’“”•–—˜™š›œ\u009DžŸ";
const cp1252 = (code: number) => (code >= 0x80 && code <= 0x9f ? CP1252[code - 0x80]! : String.fromCharCode(code));

/** RTF to plain text: keeps paragraphs, drops control words, groups like fonts and colours. */
export function rtfToText(rtf: string): string {
  let out = rtf.replace(/\{\\\*[^{}]*\}|\{\\(fonttbl|colortbl|stylesheet|info)[\s\S]*?\}\s*\}?/g, "");
  out = out
    .replace(/\\par[d]?\b ?|\\line\b ?/g, "\n")
    .replace(/\\tab\b ?/g, "\t")
    .replace(/\\'([0-9a-f]{2})/gi, (_, h: string) => cp1252(parseInt(h, 16)))
    .replace(/\\u(-?\d+)\??/g, (_, n: string) => String.fromCodePoint((Number(n) + 65536) % 65536))
    .replace(/\\[a-z]+-?\d* ?/gi, "")
    .replace(/[{}]/g, "")
    .replace(/\\([\\{}])/g, "$1");
  return out.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

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
    const text = await this.extract(bytes, job.mimeType);
    if (text.replace(/\s/g, "").length < 40) {
      throw new UnrecoverableError("We couldn't read any text in this file. If it's a scan, export it as a PDF with selectable text or a Word file.");
    }
    const basic = parseResumeText(text);
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

  private async extract(bytes: Uint8Array, mimeType: ResumeImportJob["mimeType"]): Promise<string> {
    try {
      switch (mimeType) {
        case "application/pdf": {
          const pdf = await getDocumentProxy(bytes);
          const { text } = await extractText(pdf, { mergePages: true });
          return text;
        }
        case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
          const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
          return value;
        }
        case "application/vnd.oasis.opendocument.text": {
          const files = unzipSync(bytes, { filter: (f) => f.name === "content.xml" });
          return markupToText(strFromU8(files["content.xml"] ?? new Uint8Array()));
        }
        case "application/rtf":
          return rtfToText(new TextDecoder("latin1").decode(bytes));
        case "text/html":
          return markupToText(new TextDecoder().decode(bytes));
        default:
          return new TextDecoder().decode(bytes).replace(/^\uFEFF/, "").replace(/\r/g, "");
      }
    } catch {
      throw new UnrecoverableError("This file couldn't be opened. Check it isn't password-protected or damaged.");
    }
  }
}
