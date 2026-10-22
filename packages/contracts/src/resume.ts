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
  details: z
    .object({
      dateOfBirth: text(60),
      nationality: text(80),
      gender: text(40),
      maritalStatus: text(40),
      visaStatus: text(120),
      drivingLicence: text(80),
      fatherName: text(120),
      idNumber: text(40),
      religion: text(60),
    })
    .default({ dateOfBirth: "", nationality: "", gender: "", maritalStatus: "", visaStatus: "", drivingLicence: "", fatherName: "", idNumber: "", religion: "" }),
  /** A small JPEG/PNG/WebP data URL (the editor crops and downsizes to ≤ 400 px). */
  photo: z
    .string()
    .max(220_000)
    .refine((v) => v === "" || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v), "Photo must be an image")
    .default(""),
  settings: z
    .object({
      direction: z.enum(["auto", "ltr", "rtl"]).default("auto"),
      language: z.enum(["auto", "en", "ur", "ar"]).default("auto"),
      region: z.enum(["default", "us", "uk", "europass", "gulf", "south_asia"]).default("default"),
      photo: z.object({ show: z.boolean().default(true), shape: z.enum(["circle", "square", "rounded"]).default("circle") }).default({ show: true, shape: "circle" }),
    })
    .default({ direction: "auto", language: "auto", region: "default", photo: { show: true, shape: "circle" } }),
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
export type PageSize = z.output<typeof PageSizeSchema>;

/** Presentation settings that aren't content ("Fit to one page" shrinks the type a little). */
export const ResumeStyleSchema = z.object({ fontScale: z.number().min(0.7).max(1.15).default(1) });
export type ResumeStyle = z.output<typeof ResumeStyleSchema>;

export const CreateResumeSchema = z.object({
  title: z.string().trim().min(1).max(120).default("Untitled CV"),
  templateId: TemplateIdSchema.default("classic"),
  accent: AccentSchema.default(null),
  pageSize: PageSizeSchema.default("A4"),
  style: ResumeStyleSchema.optional(),
  data: ResumeDataSchema.optional(),
  /** A tailored copy: the CV it comes from and the job it targets. */
  baseResumeId: z.string().min(1).max(64).optional(),
  jobId: z.string().min(1).max(64).optional(),
});
export type CreateResumeInput = z.input<typeof CreateResumeSchema>;
export type CreateResumeDto = z.output<typeof CreateResumeSchema>;

export const UpdateResumeSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    templateId: TemplateIdSchema,
    accent: AccentSchema,
    pageSize: PageSizeSchema,
    style: ResumeStyleSchema,
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
  style: ResumeStyleSchema,
  baseResumeId: z.string().nullable(),
  jobId: z.string().nullable(),
  updatedAt: z.string(),
  createdAt: z.string(),
});
export type ResumeSummary = z.output<typeof ResumeSummarySchema>;

export const ResumeSchema = ResumeSummarySchema.extend({ data: ResumeDataSchema });
export type ResumeDto = z.output<typeof ResumeSchema>;

export const StepIdSchema = z.enum(STEP_IDS);

export const ResumeVersionSchema = z.object({
  id: z.string(),
  reason: z.string(),
  templateId: z.string(),
  createdAt: z.string(),
});
export type ResumeVersionDto = z.output<typeof ResumeVersionSchema>;

export const CreateVersionSchema = z.object({ reason: z.enum(["manual", "download"]).default("manual") });
export type CreateVersionDto = z.output<typeof CreateVersionSchema>;
