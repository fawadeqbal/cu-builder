import { z } from "zod";
import { ResumeDataSchema } from "./resume";

const short = (max: number) => z.string().trim().min(1).max(max);

export const RewriteModeSchema = z.enum(["grammar", "shorter", "formal", "confident"]);
export const LetterToneSchema = z.enum(["formal", "warm", "concise"]);
export const LetterLengthSchema = z.enum(["short", "medium", "long"]);

export const ImproveBulletSchema = z.object({ bullet: short(600), role: z.string().max(160).optional(), company: z.string().max(160).optional() });
export const WriteSummarySchema = z.object({ cv: ResumeDataSchema, targetTitle: z.string().max(160).optional() });
export const RewriteSchema = z.object({ text: short(4000), mode: RewriteModeSchema });
export const SuggestSkillsSchema = z.object({ cv: ResumeDataSchema, targetTitle: z.string().max(160).optional() });

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
