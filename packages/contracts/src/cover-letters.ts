import { z } from "zod";
import { LetterLengthSchema, LetterToneSchema } from "./ai";
import { AccentSchema, PageSizeSchema, TemplateIdSchema } from "./resume";

const text = (max: number) => z.string().max(max).default("");

export const LetterDataSchema = z.object({
  recipient: text(200),
  company: text(200),
  address: text(400),
  date: text(80),
  subject: text(300),
  greeting: text(200),
  paragraphs: z.array(z.string().max(3000)).max(10).default([]),
  closing: text(120),
  signature: text(200),
});
export type LetterData = z.output<typeof LetterDataSchema>;

export const CreateCoverLetterSchema = z.object({
  title: z.string().trim().min(1).max(160).default("Cover letter"),
  resumeId: z.string().optional(),
  jobId: z.string().optional(),
  templateId: TemplateIdSchema.optional(),
  accent: AccentSchema.optional(),
  pageSize: PageSizeSchema.optional(),
  data: LetterDataSchema.optional(),
});
export type CreateCoverLetterDto = z.output<typeof CreateCoverLetterSchema>;

export const UpdateCoverLetterSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    resumeId: z.string().nullable(),
    jobId: z.string().nullable(),
    templateId: TemplateIdSchema,
    accent: AccentSchema,
    pageSize: PageSizeSchema,
    data: LetterDataSchema,
    shareEnabled: z.boolean(),
  })
  .partial();
export type UpdateCoverLetterDto = z.output<typeof UpdateCoverLetterSchema>;

export const CoverLetterSchema = z.object({
  id: z.string(),
  title: z.string(),
  resumeId: z.string().nullable(),
  jobId: z.string().nullable(),
  templateId: z.string(),
  accent: z.string().nullable(),
  pageSize: PageSizeSchema,
  data: LetterDataSchema,
  shareSlug: z.string().nullable(),
  shareEnabled: z.boolean(),
  viewCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CoverLetterDto = z.output<typeof CoverLetterSchema>;

export const DraftLetterSchema = z.object({
  resumeId: z.string().min(1),
  jobId: z.string().min(1),
  tone: LetterToneSchema.default("formal"),
  length: LetterLengthSchema.default("medium"),
});
export type DraftLetterDto = z.output<typeof DraftLetterSchema>;

export const LetterDraftSchema = z.object({ greeting: z.string(), paragraphs: z.array(z.string()), closing: z.string() });

export const PublicLetterSchema = z.object({
  title: z.string(),
  templateId: z.string(),
  accent: z.string().nullable(),
  pageSize: PageSizeSchema,
  data: LetterDataSchema,
  sender: z.object({ name: z.string(), headline: z.string(), email: z.string(), phone: z.string(), location: z.string() }),
});
export type PublicLetterDto = z.output<typeof PublicLetterSchema>;
