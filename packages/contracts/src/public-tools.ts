import type { AtsReport, CV, JobMatch } from "@cvb/domain";
import { z } from "zod";
import { IMPORT_MAX_BYTES } from "./imports";

/*
 * Free tools for visitors without an account: the ATS checker and a few AI writing helpers.
 * Nothing sent here is stored; each tool is rate-limited per visitor (IP).
 */

/** File types the ATS checker reads (no JSON backups: those are for the editor's own import). */
export const ATS_CHECK_ACCEPT =
  ".pdf,.docx,.odt,.rtf,.txt,.md,.html,.htm,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text,application/rtf,text/plain,text/markdown,text/html";
export const ATS_CHECK_MAX_BYTES = IMPORT_MAX_BYTES;
/** Longest CV text read (pasted or extracted); a real CV is far shorter. */
export const ATS_CHECK_MAX_TEXT = 30_000;
/** Free ATS checks per visitor per hour. */
export const ATS_CHECKS_PER_HOUR = 10;
/** Free AI writing uses per visitor per day (signed-in people use their credits instead). */
export const PUBLIC_AI_DAILY_LIMIT = 3;

/** Empty form fields (multipart sends "") count as not given. */
const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : undefined));

/** JSON body, or the text fields of a multipart upload (the file goes in `file`). */
export const AtsCheckSchema = z.object({
  text: optionalText(ATS_CHECK_MAX_TEXT),
  jobTitle: optionalText(160),
  jobDescription: optionalText(20_000),
});
export type AtsCheckInput = z.output<typeof AtsCheckSchema>;

export type AtsCheckDto = {
  report: AtsReport;
  /** Keywords from the job advert, when one was given. */
  match: JobMatch | null;
  /** The CV as it was read, ready to open in the builder. */
  cv: CV;
  /** Things the reader wasn't sure about. */
  warnings: string[];
  source: {
    kind: "file" | "text";
    /** "pdf", "docx", "odt", "rtf", "html" or "txt" for a file. */
    fileType: string | null;
    pages: number | null;
    words: number;
  };
};

export type PublicAiUsageDto = {
  limit: number;
  used: number;
  remaining: number;
  /** When the daily allowance starts again (ISO time, midnight UTC). */
  resetsAt: string;
  /** False when no AI model is connected and the basic offline helper answers instead. */
  aiConnected: boolean;
};

/** Every free AI answer carries the visitor's remaining uses, so the counter updates. */
export type WithPublicUsage<T> = T & { usage: PublicAiUsageDto };
