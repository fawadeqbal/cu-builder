import { z } from "zod";
import { ResumeDataSchema } from "./resume";

const short = (max: number) => z.string().trim().min(1).max(max);

export const RewriteModeSchema = z.enum(["grammar", "shorter", "formal", "confident"]);
export const LetterToneSchema = z.enum(["formal", "warm", "concise"]);
export const LetterLengthSchema = z.enum(["short", "medium", "long"]);

export const ImproveBulletSchema = z.object({ bullet: short(600), role: z.string().max(160).optional(), company: z.string().max(160).optional() });
/** Keywords from a job advert to weave in where the person's facts support them (ATS matching). */
const KeywordsSchema = z.array(z.string().trim().min(1).max(60)).max(20).optional();
export const WriteSummarySchema = z.object({ cv: ResumeDataSchema, targetTitle: z.string().max(160).optional(), keywords: KeywordsSchema });
export const RewriteSchema = z.object({ text: short(4000), mode: RewriteModeSchema });
export const SuggestSkillsSchema = z.object({ cv: ResumeDataSchema, targetTitle: z.string().max(160).optional() });

/** One job's or project's lines rewritten (or written from notes) as achievement lines. */
export const ImproveEntrySchema = z
  .object({
    kind: z.enum(["experience", "project"]),
    title: z.string().trim().max(200).default(""),
    organisation: z.string().max(200).optional(),
    bullets: z.array(z.string().max(600)).max(20).default([]),
    notes: z.string().max(4000).optional(),
    stack: z.string().max(600).optional(),
    targetTitle: z.string().max(160).optional(),
    keywords: KeywordsSchema,
  })
  .refine((v) => v.bullets.some((b) => b.trim()) || (v.notes ?? "").trim().length > 3, "Add some lines or notes first");
export const OrganiseSkillsSchema = z.object({
  skills: z.array(z.object({ category: z.string().max(80), items: z.string().max(2000) })).max(30),
  extra: z.string().max(2000).optional(),
  targetTitle: z.string().max(160).optional(),
});
export const BulletsResultSchema = z.object({ bullets: z.array(z.string()) });
export const SkillGroupsResultSchema = z.object({ skills: z.array(z.object({ category: z.string(), items: z.string() })) });

/** A LinkedIn profile (headline, About, one description per job, top skills) written from a CV. */
export const LinkedInProfileRequestSchema = z.object({ cv: ResumeDataSchema, targetTitle: z.string().max(160).optional() });
export const LinkedInProfileSchema = z.object({
  headline: z.string(),
  headlineOptions: z.array(z.string()),
  about: z.string(),
  experience: z.array(z.object({ id: z.string(), role: z.string(), company: z.string(), description: z.string() })),
  skills: z.array(z.string()),
});
export type LinkedInProfileDto = z.output<typeof LinkedInProfileSchema>;

export const OptionsSchema = z.object({ options: z.array(z.string()) });
export const TextResultSchema = z.object({ text: z.string() });
export const SkillsResultSchema = z.object({ skills: z.array(z.string()) });

export const CreditsSchema = z.object({
  allowance: z.number(),
  usedThisMonth: z.number(),
  purchasedLeft: z.number(),
  remaining: z.number(),
  resetsAt: z.string(),
  provider: z.string(),
});
export type CreditsDto = z.output<typeof CreditsSchema>;

/** Every AI response carries the credits left, so the counter updates without another call. */
export type WithCredits<T> = T & { credits: CreditsDto };
