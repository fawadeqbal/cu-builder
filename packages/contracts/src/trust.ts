import {
  normalizeWhatsappNumber,
  REVIEW_NAME_MAX,
  REVIEW_STATUSES,
  REVIEW_TEXT_MAX,
  REVIEW_TEXT_MIN,
  REVIEW_TITLE_MAX,
  WHATSAPP_MESSAGE_MAX,
} from "@cvb/domain";
import { z } from "zod";
import { PaginationQuerySchema } from "./common";

// ─── Public stats ────────────────────────────────────────────────────────────

/** Real counts for the landing page; a figure under its threshold is null (see `publicStats`). */
export const PublicStatsSchema = z.object({
  cvsLast7Days: z.number().int().nullable(),
  cvsTotal: z.number().int().nullable(),
  pdfsLast7Days: z.number().int().nullable(),
  pdfsTotal: z.number().int().nullable(),
});
export type PublicStatsDto = z.output<typeof PublicStatsSchema>;

// ─── Reviews ─────────────────────────────────────────────────────────────────

export const ReviewStatusSchema = z.enum(REVIEW_STATUSES);

/** Create or update the signed-in user's review. Domain `reviewProblem` adds the remaining rules. */
export const SaveReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().min(REVIEW_TEXT_MIN).max(REVIEW_TEXT_MAX),
  displayName: z.string().trim().min(1).max(REVIEW_NAME_MAX),
  jobTitle: z.string().trim().max(REVIEW_TITLE_MAX).nullable().default(null),
});
export type SaveReviewDto = z.output<typeof SaveReviewSchema>;

/** A review as its author sees it. */
export const ReviewSchema = z.object({
  id: z.string(),
  rating: z.number().int(),
  text: z.string(),
  displayName: z.string(),
  jobTitle: z.string().nullable(),
  status: ReviewStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ReviewDto = z.output<typeof ReviewSchema>;

/** An approved review on the public site: no account details. */
export const PublicReviewSchema = ReviewSchema.pick({
  id: true,
  rating: true,
  text: true,
  displayName: true,
  jobTitle: true,
  createdAt: true,
});
export type PublicReviewDto = z.output<typeof PublicReviewSchema>;

export const AdminReviewSchema = ReviewSchema.extend({ userEmail: z.string(), moderatedAt: z.string().nullable() });
export type AdminReviewDto = z.output<typeof AdminReviewSchema>;

export const PublicReviewsQuerySchema = PaginationQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(30).default(6),
});
export type PublicReviewsQuery = z.output<typeof PublicReviewsQuerySchema>;

export const AdminReviewsQuerySchema = PaginationQuerySchema.extend({ status: ReviewStatusSchema.optional() });
export type AdminReviewsQuery = z.output<typeof AdminReviewsQuerySchema>;

export const ModerateReviewSchema = z.object({ status: z.enum(["approved", "rejected"]) });
export type ModerateReviewDto = z.output<typeof ModerateReviewSchema>;

// ─── Site settings ───────────────────────────────────────────────────────────

/** Settings the admin manages for the whole site. An empty number means no WhatsApp button. */
export const SiteSettingsSchema = z.object({
  /** Digits only, international format ("923001234567"), or "". */
  whatsappNumber: z.string(),
  whatsappMessage: z.string(),
});
export type SiteSettingsDto = z.output<typeof SiteSettingsSchema>;

export const UpdateSiteSettingsSchema = z.object({
  whatsappNumber: z
    .string()
    .trim()
    .max(32)
    .refine(
      (v) => v === "" || normalizeWhatsappNumber(v) !== null,
      "Use the full international number, like +92 300 1234567",
    ),
  whatsappMessage: z.string().trim().max(WHATSAPP_MESSAGE_MAX).default(""),
});
export type UpdateSiteSettingsDto = z.output<typeof UpdateSiteSettingsSchema>;
