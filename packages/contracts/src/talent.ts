import { TALENT_LIMITS, TALENT_SHARE } from "@cvb/domain";
import { z } from "zod";
import { ResumeDataSchema } from "./resume";

/*
 * Opt-in talent search: a job seeker's "Let recruiters find me" profile, and what agency
 * recruiters search, read and send.
 */

export const TalentShareSchema = z.enum(TALENT_SHARE);

/** The job seeker's own profile (with who has written to them). */
export const TalentProfileSchema = z.object({
  enabled: z.boolean(),
  resumeId: z.string().nullable(),
  headline: z.string(),
  location: z.string(),
  roles: z.array(z.string()),
  share: TalentShareSchema,
  updatedAt: z.string().nullable(),
  /** Messages recruiters sent through the platform, newest first. */
  contacts: z.array(z.object({ orgName: z.string(), senderName: z.string(), createdAt: z.string() })),
});
export type TalentProfileDto = z.output<typeof TalentProfileSchema>;

export const UpdateTalentProfileSchema = z.object({
  enabled: z.boolean(),
  resumeId: z.string().min(1).max(64),
  headline: z.string().trim().min(2).max(120),
  location: z.string().trim().max(120).default(""),
  roles: z.array(z.string().trim().max(60)).max(TALENT_LIMITS.roles).default([]),
  share: TalentShareSchema.default("summary"),
});
export type UpdateTalentProfileDto = z.output<typeof UpdateTalentProfileSchema>;

export const TalentSearchQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  location: z.string().trim().max(120).optional(),
  role: z.string().trim().max(120).optional(),
  cursor: z.coerce.number().int().min(0).max(10_000).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type TalentSearchQuery = z.output<typeof TalentSearchQuerySchema>;

export const TalentResultSchema = z.object({
  id: z.string(),
  headline: z.string(),
  location: z.string(),
  roles: z.array(z.string()),
  skills: z.array(z.string()),
  share: TalentShareSchema,
  /** When the CV was last changed. */
  updatedAt: z.string(),
});
export type TalentResultDto = z.output<typeof TalentResultSchema>;

export const TalentSearchResultSchema = z.object({
  items: z.array(TalentResultSchema),
  /** Offset of the next page, or null. */
  nextCursor: z.number().nullable(),
  /** Messages the caller can still send in the next 24 hours. */
  contactsLeft: z.number(),
});
export type TalentSearchResultDto = z.output<typeof TalentSearchResultSchema>;

/** What the person chose to share, read-only. */
export const TalentDetailSchema = TalentResultSchema.extend({
  cv: ResumeDataSchema,
  templateId: z.string(),
  accent: z.string().nullable(),
  /** When someone in this organisation last wrote to them. */
  lastContactedAt: z.string().nullable(),
});
export type TalentDetailDto = z.output<typeof TalentDetailSchema>;

export const TalentContactSchema = z.object({ message: z.string().trim().min(20).max(2000) });
export type TalentContactDto = z.output<typeof TalentContactSchema>;

export const TalentContactResultSchema = z.object({ contactsLeft: z.number() });
export type TalentContactResultDto = z.output<typeof TalentContactResultSchema>;

/** The organisation's log of messages sent through talent search. */
export const TalentContactLogSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  headline: z.string(),
  senderName: z.string(),
  message: z.string(),
  createdAt: z.string(),
});
export type TalentContactLogDto = z.output<typeof TalentContactLogSchema>;
