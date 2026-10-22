import { z } from "zod";
import { PlanSchema } from "./billing";

export const MeSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  emailVerified: z.boolean(),
  locale: z.string(),
  role: z.enum(["user", "admin"]),
  plan: PlanSchema,
  planSource: z.enum(["base", "subscription", "pass", "organization"]),
  limits: z.object({ resumes: z.number().nullable(), aiCreditsPerMonth: z.number() }),
});
export type MeDto = z.output<typeof MeSchema>;

export const UpdateMeSchema = z.object({ name: z.string().trim().min(1).max(120), locale: z.string().max(10) }).partial();
export type UpdateMeDto = z.output<typeof UpdateMeSchema>;

/** Which sign-in methods the server has configured, so the web app shows only working buttons. */
export const AuthProvidersSchema = z.object({
  emailPassword: z.boolean(),
  magicLink: z.boolean(),
  google: z.boolean(),
  linkedin: z.boolean(),
  microsoft: z.boolean().default(false),
});
export type AuthProvidersDto = z.output<typeof AuthProvidersSchema>;

export const SessionSchema = z.object({ user: MeSchema.nullable() });
export type SessionDto = z.output<typeof SessionSchema>;
