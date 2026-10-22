import { z } from "zod";

/** A LinkedIn data export (the ZIP from Settings → Data privacy → Get a copy of your data). */
export const LINKEDIN_EXPORT_MIME = "application/x-linkedin-export+zip";

/** What a CV can be imported from: PDF, Word, OpenDocument, RTF, plain text/Markdown, HTML, JSON backups and LinkedIn data exports. */
export const IMPORT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "application/rtf",
  "text/plain",
  "text/html",
  "application/json",
  LINKEDIN_EXPORT_MIME,
] as const;
export type ImportMimeType = (typeof IMPORT_MIME_TYPES)[number];
/** For file pickers. */
export const IMPORT_ACCEPT = ".pdf,.docx,.odt,.rtf,.txt,.md,.markdown,.html,.htm,.json,.zip,application/zip,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text,application/rtf,text/plain,text/markdown,text/html,application/json";
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
/** LinkedIn data exports can be larger (connections, messages); only the CV files are kept. */
export const IMPORT_ZIP_MAX_BYTES = 25 * 1024 * 1024;
/** The upload limit for a file, by name: ZIPs may be larger. */
export const importLimitFor = (fileName: string): number => (/\.zip$/i.test(fileName) ? IMPORT_ZIP_MAX_BYTES : IMPORT_MAX_BYTES);

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
