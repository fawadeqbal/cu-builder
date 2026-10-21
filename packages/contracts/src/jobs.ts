import { z } from "zod";

/**
 * Background jobs: queue names, job names and payloads. Producers (api) and consumers
 * (worker) both validate against these, so a payload change breaks the build on both sides.
 */
export const QUEUES = {
  email: "email",
  resumeImport: "resume-import",
} as const;
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export const EmailJobSchema = z.discriminatedUnion("template", [
  z.object({ template: z.literal("welcome"), to: z.email(), name: z.string().max(120) }),
  z.object({ template: z.literal("resume-shared"), to: z.email(), resumeTitle: z.string(), url: z.url() }),
]);
export type EmailJob = z.output<typeof EmailJobSchema>;

export const ResumeImportJobSchema = z.object({
  userId: z.string(),
  /** Storage key of the uploaded PDF or DOCX. */
  fileKey: z.string().min(1),
  fileName: z.string().max(240),
  mimeType: z.enum([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]),
});
export type ResumeImportJob = z.output<typeof ResumeImportJobSchema>;

/** Queue → job name → payload schema. The single map both sides type against. */
export const JOBS = {
  [QUEUES.email]: { send: EmailJobSchema },
  [QUEUES.resumeImport]: { parse: ResumeImportJobSchema },
} as const;

export type JobMap = typeof JOBS;
export type JobName<Q extends QueueName> = keyof JobMap[Q] & string;
export type JobPayload<Q extends QueueName, N extends JobName<Q>> = JobMap[Q][N] extends z.ZodType
  ? z.output<JobMap[Q][N]>
  : never;
