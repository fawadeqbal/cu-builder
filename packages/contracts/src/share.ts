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
  /** Who it's for, e.g. "Acme application". */
  label: z.string().trim().max(80).optional(),
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
    label: z.string().trim().max(80).nullable(),
    notifyOnView: z.boolean(),
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
  label: z.string().nullable(),
  notifyOnView: z.boolean(),
  createdAt: z.string(),
});
export type ShareLinkDto = z.output<typeof ShareLinkSchema>;

export const UnlockShareSchema = z.object({ password: z.string().min(1).max(100) });

/** What a visitor of a share link receives. */
export const PublicResumeSchema = z.object({
  /** Identifies this visit for time-on-page and download tracking. */
  viewId: z.string().nullable(),
  title: z.string(),
  ownerName: z.string(),
  templateId: z.string(),
  accent: z.string().nullable(),
  pageSize: PageSizeSchema,
  data: ResumeDataSchema,
});
export type PublicResumeDto = z.output<typeof PublicResumeSchema>;

/** Sent by the public page: how long it stayed open, and whether the PDF was downloaded. */
export const ViewPingSchema = z.object({ viewId: z.string().min(1).max(64), durationMs: z.number().int().min(0).max(6 * 3600 * 1000).optional(), downloaded: z.boolean().optional() });

export const LinkAnalyticsSchema = z.object({
  linkId: z.string(),
  views: z.number(),
  uniqueViewers: z.number(),
  avgSeconds: z.number(),
  downloads: z.number(),
  /** Views per day for the last 30 days, oldest first. */
  daily: z.array(z.object({ date: z.string(), views: z.number() })),
  referrers: z.array(z.object({ referrer: z.string(), views: z.number() })),
  countries: z.array(z.object({ country: z.string(), views: z.number() })),
  devices: z.array(z.object({ device: z.string(), views: z.number() })),
  recent: z.array(z.object({ viewedAt: z.string(), seconds: z.number(), downloaded: z.boolean(), referrer: z.string().nullable(), country: z.string().nullable(), device: z.string().nullable() })),
});
export type LinkAnalyticsDto = z.output<typeof LinkAnalyticsSchema>;
