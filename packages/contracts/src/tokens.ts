import { z } from "zod";

export const CreateApiTokenSchema = z.object({ name: z.string().trim().min(1).max(60).default("Browser extension") });
export const ApiTokenSchema = z.object({ id: z.string(), name: z.string(), prefix: z.string(), lastUsedAt: z.string().nullable(), createdAt: z.string() });
export type ApiTokenDto = z.output<typeof ApiTokenSchema>;
/** Returned once, at creation; only a hash is stored. */
export const CreatedApiTokenSchema = ApiTokenSchema.extend({ token: z.string() });
export type CreatedApiTokenDto = z.output<typeof CreatedApiTokenSchema>;
