import { z } from "zod";

/**
 * Background jobs: queue names, job names and payloads. Producers (api) and consumers
 * (worker) both validate against these, so a payload change breaks the build on both sides.
 */
export const QUEUES = {
  email: "email",
  resumeImport: "resume-import",
  maintenance: "maintenance",
  /** Reminders, weekly progress digests and job alerts (scheduled). */
  notifications: "notifications",
  /** Agencies' bulk CV uploads: parse each file into a candidate CV. */
  candidateImport: "candidate-import",
  /** Expert orders: deadline warnings, auto-completion and payouts (scheduled). */
  services: "services",
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
  z.object({
    template: z.literal("resume-viewed"),
    to: z.email(),
    resumeTitle: z.string(),
    views: z.number().int(),
    /** Who the link was made for ("Acme application"). */
    label: z.string().max(80).optional(),
  }),
  z.object({
    template: z.literal("reminders"),
    to: z.email(),
    name: z.string().max(120),
    items: z.array(z.object({ title: z.string().max(240), dueAt: z.string() })).min(1).max(30),
  }),
  z.object({
    template: z.literal("weekly-digest"),
    to: z.email(),
    name: z.string().max(120),
    stats: z.object({ added: z.number(), applied: z.number(), interviews: z.number(), offers: z.number(), total: z.number() }),
    upcoming: z.array(z.object({ title: z.string().max(240), dueAt: z.string() })).max(10),
  }),
  z.object({
    template: z.literal("job-alert"),
    to: z.email(),
    name: z.string().max(120),
    jobs: z
      .array(z.object({ title: z.string().max(240), company: z.string().max(200), location: z.string().max(200), url: z.string().max(2000), score: z.number().nullable() }))
      .min(1)
      .max(10),
  }),
  z.object({
    template: z.literal("notice"),
    to: z.email(),
    name: z.string().max(120),
    subject: z.string().max(200),
    lines: z.array(z.string().max(1000)).min(1).max(12),
    action: z.object({ label: z.string().max(60), url: z.url() }).optional(),
  }),
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

export const CandidateImportJobSchema = z.object({
  candidateId: z.string(),
  orgId: z.string(),
  fileKey: z.string().min(1),
  fileName: z.string().max(240),
  mimeType: z.enum([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]),
});
export type CandidateImportJob = z.output<typeof CandidateImportJobSchema>;

/** Daily clean-up: emptied trash, old upload files, expired sign-in tokens. */
export const MaintenanceJobSchema = z.object({}).default({});
export type MaintenanceJob = z.output<typeof MaintenanceJobSchema>;

/** Queue → job name → payload schema. The single map both sides type against. */
export const JOBS = {
  [QUEUES.email]: { send: EmailJobSchema },
  [QUEUES.resumeImport]: { parse: ResumeImportJobSchema },
  [QUEUES.maintenance]: { purge: MaintenanceJobSchema },
  [QUEUES.candidateImport]: { parse: CandidateImportJobSchema },
  [QUEUES.notifications]: { reminders: MaintenanceJobSchema, digest: MaintenanceJobSchema, alerts: MaintenanceJobSchema },
  [QUEUES.services]: { deadlines: MaintenanceJobSchema, autocomplete: MaintenanceJobSchema },
} as const;

export type JobMap = typeof JOBS;
export type JobName<Q extends QueueName> = keyof JobMap[Q] & string;
export type JobPayload<Q extends QueueName, N extends JobName<Q>> = JobMap[Q][N] extends z.ZodType
  ? z.output<JobMap[Q][N]>
  : never;
