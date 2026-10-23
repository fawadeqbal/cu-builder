import { TEMPLATE_TIERS } from "@cvb/domain";
import { z } from "zod";
import { PlanSchema } from "./billing";

export const AdminUsersQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminUsersQuery = z.output<typeof AdminUsersQuerySchema>;

export const AdminUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.string(),
  basePlan: PlanSchema,
  plan: PlanSchema,
  banned: z.boolean(),
  resumes: z.number(),
  createdAt: z.string(),
});
export type AdminUserDto = z.output<typeof AdminUserSchema>;

export const AdminUpdateUserSchema = z
  .object({ basePlan: PlanSchema, role: z.enum(["user", "admin"]), banned: z.boolean() })
  .partial();
export type AdminUpdateUserDto = z.output<typeof AdminUpdateUserSchema>;

export const AdminMetricsSchema = z.object({
  users: z.object({ total: z.number(), last7Days: z.number() }),
  resumes: z.number(),
  paying: z.number(),
  activePasses: z.number(),
});
export type AdminMetricsDto = z.output<typeof AdminMetricsSchema>;

export const TemplateSettingSchema = z.object({
  templateId: z.string(),
  enabled: z.boolean(),
  tier: z.enum(TEMPLATE_TIERS).nullable(),
  sortOrder: z.number().nullable(),
});
export type TemplateSettingDto = z.output<typeof TemplateSettingSchema>;

export const UpdateTemplateSettingSchema = TemplateSettingSchema.omit({ templateId: true }).partial();
export type UpdateTemplateSettingDto = z.output<typeof UpdateTemplateSettingSchema>;
