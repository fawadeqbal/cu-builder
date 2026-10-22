import { z } from "zod";

export const FeedQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  location: z.string().trim().max(120).optional(),
  remote: z.enum(["true", "false"]).optional().transform((v) => v === "true"),
});
export type FeedQueryDto = z.output<typeof FeedQuerySchema>;

export const FeedJobSchema = z.object({
  externalId: z.string(),
  source: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string(),
  remote: z.boolean(),
  salary: z.string(),
  url: z.string(),
  description: z.string(),
  postedAt: z.string().nullable(),
  /** Match against the person's main CV, when they have one. */
  score: z.number().nullable(),
  /** Already saved to the tracker. */
  saved: z.boolean(),
});
export type FeedJobDto = z.output<typeof FeedJobSchema>;

export const JobPreferencesSchema = z.object({
  titles: z.array(z.string().trim().min(1).max(80)).max(5).default([]),
  location: z.string().trim().max(120).default(""),
  remote: z.boolean().default(false),
  salaryMin: z.number().int().nonnegative().nullable().default(null),
  alerts: z.enum(["off", "daily", "weekly"]).default("off"),
  /** The Monday progress email. */
  weeklyDigest: z.boolean().default(true),
});
export type JobPreferencesDto = z.output<typeof JobPreferencesSchema>;

export const SaveFeedJobSchema = FeedJobSchema.omit({ score: true, saved: true });
export type SaveFeedJobDto = z.output<typeof SaveFeedJobSchema>;

export const SalaryRangeSchema = z.object({ p25: z.number(), median: z.number(), p75: z.number(), samples: z.number(), source: z.string() }).nullable();
