import { z } from "zod";

export const IMPORT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;
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
