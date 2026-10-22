import { z } from "zod";
import { CreateJobSchema, JobSchema } from "./job-posts";

export const BoardColumnSchema = z.object({ key: z.string().min(1).max(40), label: z.string().trim().min(1).max(40) });
export const BoardSchema = z.object({ columns: z.array(BoardColumnSchema).min(1).max(12) });
export type BoardDto = z.output<typeof BoardSchema>;

export const ContactSchema = z.object({
  name: z.string().max(120).default(""),
  role: z.string().max(120).default(""),
  email: z.string().max(200).default(""),
  phone: z.string().max(60).default(""),
});

export const ResearchSchema = z.object({
  values: z.string().max(4000).default(""),
  links: z.array(z.string().max(500)).max(20).default([]),
  questionsToAsk: z.array(z.string().max(500)).max(20).default([]),
  notes: z.string().max(8000).default(""),
});

export const OfferDetailsSchema = z.object({
  baseSalary: z.number().nonnegative().nullable().default(null),
  currency: z.string().max(10).default(""),
  bonus: z.number().nonnegative().nullable().default(null),
  equity: z.number().nonnegative().nullable().default(null),
  benefits: z.string().max(2000).default(""),
  location: z.string().max(200).default(""),
  remote: z.enum(["onsite", "hybrid", "remote", ""]).default(""),
  growth: z.number().int().min(1).max(5).nullable().default(null),
  deadline: z.string().max(40).default(""),
  notes: z.string().max(4000).default(""),
});
export type OfferDetailsDto = z.output<typeof OfferDetailsSchema>;

const date = z.iso.datetime().nullable();

export const CreateApplicationSchema = z
  .object({
    jobId: z.string().optional(),
    /** Or create the job in the same call (the extension, the feed). */
    job: CreateJobSchema.optional(),
    status: z.string().max(40).optional(),
    resumeId: z.string().optional(),
  })
  .refine((v) => v.jobId || v.job, { message: "A job is required" });
export type CreateApplicationDto = z.output<typeof CreateApplicationSchema>;

export const UpdateApplicationSchema = z
  .object({
    status: z.string().max(40),
    resumeId: z.string().nullable(),
    coverLetterId: z.string().nullable(),
    shareLinkId: z.string().nullable(),
    salaryMin: z.number().int().nonnegative().nullable(),
    salaryMax: z.number().int().nonnegative().nullable(),
    currency: z.string().max(10).nullable(),
    contacts: z.array(ContactSchema).max(20),
    notes: z.string().max(20_000),
    research: ResearchSchema,
    offer: OfferDetailsSchema.nullable(),
    appliedAt: date,
    interviewAt: date,
    deadlineAt: date,
    followUpDays: z.number().int().min(1).max(60).nullable(),
    archived: z.boolean(),
  })
  .partial();
export type UpdateApplicationDto = z.output<typeof UpdateApplicationSchema>;

/** Drag and drop: the new column and the neighbours it was dropped between. */
export const MoveApplicationSchema = z.object({
  status: z.string().max(40),
  beforeId: z.string().nullable().default(null),
  afterId: z.string().nullable().default(null),
});
export type MoveApplicationDto = z.output<typeof MoveApplicationSchema>;

export const ApplicationSchema = z.object({
  id: z.string(),
  status: z.string(),
  position: z.number(),
  job: JobSchema,
  resumeId: z.string().nullable(),
  coverLetterId: z.string().nullable(),
  shareLinkId: z.string().nullable(),
  salaryMin: z.number().nullable(),
  salaryMax: z.number().nullable(),
  currency: z.string().nullable(),
  contacts: z.array(ContactSchema),
  notes: z.string(),
  research: ResearchSchema,
  offer: OfferDetailsSchema.nullable(),
  appliedAt: z.string().nullable(),
  interviewAt: z.string().nullable(),
  deadlineAt: z.string().nullable(),
  followUpDays: z.number().nullable(),
  archived: z.boolean(),
  /** Views of the share link sent with this application. */
  linkViews: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ApplicationDto = z.output<typeof ApplicationSchema>;

export const ReminderSchema = z.object({
  id: z.string(),
  applicationId: z.string().nullable(),
  kind: z.string(),
  title: z.string(),
  dueAt: z.string(),
  doneAt: z.string().nullable(),
});
export type ReminderDto = z.output<typeof ReminderSchema>;

export const CreateReminderSchema = z.object({ title: z.string().trim().min(1).max(200), dueAt: z.iso.datetime(), applicationId: z.string().optional() });
export const UpdateReminderSchema = z.object({ done: z.boolean() });
