import { z } from "zod";

/**
 * Background jobs: queue names, job names and payloads. Producers (api) and consumers
 * (worker) both validate against these, so a payload change breaks the build on both sides.
 */
export const QUEUES = {
  email: "email",
  resumeImport: "resume-import",
  maintenance: "maintenance",
} as const;
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export const EmailJobSchema = z.discriminatedUnion("template", [
  z.object({ template: z.literal("welcome"), to: z.email(), name: z.string().max(120) }),
  z.object({ template: z.literal("verify-email"), to: z.email(), name: z.string().max(120), url: z.url() }),
  z.object({ template: z.literal("magic-link"), to: z.email(), url: z.url() }),
  z.object({ template: z.literal("reset-password"), to: z.email(), name: z.string().max(120), url: z.url() }),
  z.object({
    template: z.literal("receipt"),
    to: z.email(),
    name: z.string().max(120),
    description: z.string().max(200),
    amountCents: z.number().int().nonnegative(),
    currency: z.string().length(3),
  }),
  z.object({ template: z.literal("resume-viewed"), to: z.email(), resumeTitle: z.string(), views: z.number().int() }),
]);
export type EmailJob = z.output<typeof EmailJobSchema>;

export const ResumeImportJobSchema = z.object({
  importId: z.string(),
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

/** Daily clean-up: emptied trash, old upload files, expired sign-in tokens. */
export const MaintenanceJobSchema = z.object({}).default({});
export type MaintenanceJob = z.output<typeof MaintenanceJobSchema>;

/** Queue → job name → payload schema. The single map both sides type against. */
export const JOBS = {
  [QUEUES.email]: { send: EmailJobSchema },
  [QUEUES.resumeImport]: { parse: ResumeImportJobSchema },
  [QUEUES.maintenance]: { purge: MaintenanceJobSchema },
} as const;

export type JobMap = typeof JOBS;
export type JobName<Q extends QueueName> = keyof JobMap[Q] & string;
export type JobPayload<Q extends QueueName, N extends JobName<Q>> = JobMap[Q][N] extends z.ZodType
  ? z.output<JobMap[Q][N]>
  : never;
