import { z } from "zod";

/** What a CV can be imported from: PDF, Word, OpenDocument, RTF, plain text/Markdown, HTML, and JSON backups. */
export const IMPORT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "application/rtf",
  "text/plain",
  "text/html",
  "application/json",
] as const;
export type ImportMimeType = (typeof IMPORT_MIME_TYPES)[number];
/** For file pickers. */
export const IMPORT_ACCEPT = ".pdf,.docx,.odt,.rtf,.txt,.md,.markdown,.html,.htm,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text,application/rtf,text/plain,text/markdown,text/html,application/json";
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

export const ImportStatusSchema = z.enum(["queued", "processing", "done", "failed"]);

export const ResumeImportSchema = z.object({
  id: z.string(),
  status: ImportStatusSchema,
  fileName: z.string(),
  resumeId: z.string().nullable(),
  error: z.string().nullable(),
  warnings: z.array(z.string()),
  createdAt: z.string(),
});
export type ResumeImportDto = z.output<typeof ResumeImportSchema>;
