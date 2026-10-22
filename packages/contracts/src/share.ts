import { z } from "zod";
import { PageSizeSchema, ResumeDataSchema } from "./resume";

export const ShareSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use letters, numbers and single dashes");

export const CreateShareLinkSchema = z.object({
  slug: ShareSlugSchema.optional(),
  password: z.string().min(4).max(100).optional(),
  expiresAt: z.iso.datetime().optional(),
});
export type CreateShareLinkDto = z.output<typeof CreateShareLinkSchema>;

export const UpdateShareLinkSchema = z
  .object({
    enabled: z.boolean(),
    slug: ShareSlugSchema,
    /** `null` removes the password. */
    password: z.string().min(4).max(100).nullable(),
    /** `null` removes the expiry. */
    expiresAt: z.iso.datetime().nullable(),
  })
  .partial();
export type UpdateShareLinkDto = z.output<typeof UpdateShareLinkSchema>;

export const ShareLinkSchema = z.object({
  id: z.string(),
  resumeId: z.string(),
  slug: z.string(),
  enabled: z.boolean(),
  hasPassword: z.boolean(),
  expiresAt: z.string().nullable(),
  viewCount: z.number(),
  lastViewedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type ShareLinkDto = z.output<typeof ShareLinkSchema>;

export const UnlockShareSchema = z.object({ password: z.string().min(1).max(100) });

/** What a visitor of a share link receives. */
export const PublicResumeSchema = z.object({
  title: z.string(),
  ownerName: z.string(),
  templateId: z.string(),
  accent: z.string().nullable(),
  pageSize: PageSizeSchema,
  data: ResumeDataSchema,
});
export type PublicResumeDto = z.output<typeof PublicResumeSchema>;
