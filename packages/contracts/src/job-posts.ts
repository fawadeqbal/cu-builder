import { z } from "zod";
import { ResumeDataSchema } from "./resume";

export const JobSourceSchema = z.enum(["manual", "link", "extension", "feed"]);

export const CreateJobSchema = z.object({
  title: z.string().trim().min(1).max(200),
  company: z.string().trim().max(200).default(""),
  location: z.string().trim().max(200).default(""),
  url: z.url().max(2000).optional(),
  description: z.string().max(30_000).default(""),
  source: JobSourceSchema.default("manual"),
  salary: z.string().trim().max(120).default(""),
  remote: z.boolean().default(false),
  /** The job board's id (feed jobs), so the same posting isn't saved twice. */
  externalId: z.string().max(200).optional(),
});
export type CreateJobDto = z.output<typeof CreateJobSchema>;

export const UpdateJobSchema = CreateJobSchema.omit({ source: true, externalId: true }).partial();
export type UpdateJobDto = z.output<typeof UpdateJobSchema>;

export const ImportJobUrlSchema = z.object({ url: z.url().max(2000) });

export const JobSchema = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string(),
  url: z.string().nullable(),
  description: z.string(),
  source: JobSourceSchema,
  salary: z.string(),
  remote: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type JobDto = z.output<typeof JobSchema>;

export const MatchRequestSchema = z.object({ resumeId: z.string().min(1) });

export const MatchKeywordSchema = z.object({
  keyword: z.string(),
  required: z.boolean(),
  found: z.boolean(),
  section: z.enum(["skills", "summary", "experience"]),
});

export const JobMatchSchema = z.object({
  resumeId: z.string(),
  jobId: z.string(),
  score: z.number(),
  keywords: z.array(MatchKeywordSchema),
  found: z.array(z.string()),
  missing: z.array(z.string()),
  seniority: z.object({
    job: z.string().nullable(),
    cv: z.string().nullable(),
    jobYears: z.number().nullable(),
    cvYears: z.number(),
    fit: z.enum(["under", "match", "over", "unknown"]),
  }),
  titleMatch: z.boolean(),
  /** False when the plan shows only the score and a few keywords. */
  complete: z.boolean(),
});
export type JobMatchDto = z.output<typeof JobMatchSchema>;

export const TailorRequestSchema = z.object({ jobId: z.string().min(1) });

/** A tailored proposal: nothing is saved until the person accepts changes and creates the copy. */
export const TailorProposalSchema = z.object({ proposal: ResumeDataSchema, notes: z.array(z.string()) });
export type TailorProposalDto = z.output<typeof TailorProposalSchema>;
