import { STEP_IDS, type CV } from "@cvb/domain";
import { z } from "zod";

const text = (max: number) => z.string().max(max).default("");
const id = z.string().min(1).max(64);

export const PersonalSchema = z.object({
  name: text(120),
  headline: text(160),
  tagline: text(240),
  phone: text(60),
  email: text(160),
  location: text(160),
  website: text(240),
  github: text(240),
  linkedin: text(240),
  extra: text(240),
});

const bullets = z.array(z.string().max(600)).max(30).default([]);

/** The CV document. Mirrors `CV` in @cvb/domain exactly (checked below). */
export const ResumeDataSchema = z.object({
  personal: PersonalSchema,
  summary: text(3000),
  experience: z
    .array(
      z.object({
        id,
        role: text(160),
        company: text(160),
        location: text(160),
        date: text(80),
        bullets,
        stack: text(400),
      }),
    )
    .max(40)
    .default([]),
  projects: z
    .array(
      z.object({
        id,
        name: text(160),
        date: text(80),
        links: z.array(z.string().max(240)).max(10).default([]),
        bullets,
        stack: text(400),
      }),
    )
    .max(40)
    .default([]),
  skills: z.array(z.object({ id, category: text(80), items: text(600) })).max(30).default([]),
  education: z
    .array(z.object({ id, degree: text(160), school: text(160), date: text(80), details: text(400) }))
    .max(20)
    .default([]),
  certificates: z
    .array(z.object({ id, name: text(160), issuer: text(160), year: text(20), url: text(240) }))
    .max(30)
    .default([]),
  languages: z.array(z.object({ id, name: text(60), level: text(60) })).max(20).default([]),
});

// Compile-time guarantee that the schema and the domain type never drift apart.
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const _sameShape: Equals<z.output<typeof ResumeDataSchema>, CV> = true;
void _sameShape;

export const TemplateIdSchema = z.string().min(1).max(40);
export const AccentSchema = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i)
  .nullable();
export const PageSizeSchema = z.enum(["A4", "LETTER"]);

export const CreateResumeSchema = z.object({
  title: z.string().trim().min(1).max(120).default("Untitled CV"),
  templateId: TemplateIdSchema.default("classic"),
  accent: AccentSchema.default(null),
  pageSize: PageSizeSchema.default("A4"),
  data: ResumeDataSchema.optional(),
});
export type CreateResumeInput = z.input<typeof CreateResumeSchema>;
export type CreateResumeDto = z.output<typeof CreateResumeSchema>;

export const UpdateResumeSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    templateId: TemplateIdSchema,
    accent: AccentSchema,
    pageSize: PageSizeSchema,
    data: ResumeDataSchema,
    /** Keep a restorable copy of the previous version. */
    snapshot: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).some((k) => k !== "snapshot"), { message: "Nothing to update" });
export type UpdateResumeDto = z.output<typeof UpdateResumeSchema>;

export const ResumeSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  templateId: z.string(),
  accent: z.string().nullable(),
  pageSize: PageSizeSchema,
  updatedAt: z.string(),
  createdAt: z.string(),
});
export type ResumeSummary = z.output<typeof ResumeSummarySchema>;

export const ResumeSchema = ResumeSummarySchema.extend({ data: ResumeDataSchema });
export type ResumeDto = z.output<typeof ResumeSchema>;

export const StepIdSchema = z.enum(STEP_IDS);
