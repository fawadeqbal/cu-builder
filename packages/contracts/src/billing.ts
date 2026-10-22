import { OFFER_IDS, PLANS } from "@cvb/domain";
import { z } from "zod";

export const PlanSchema = z.enum(PLANS);

export const CheckoutSchema = z.object({
  offer: z.enum(OFFER_IDS),
  provider: z.enum(["stripe", "local"]).default("stripe"),
});
export type CheckoutDto = z.output<typeof CheckoutSchema>;

export const RedirectSchema = z.object({ url: z.url() });
export type RedirectDto = z.output<typeof RedirectSchema>;

export const OfferSchema = z.object({
  id: z.enum(OFFER_IDS),
  kind: z.enum(["subscription", "pass", "credits"]),
  /** Absent for credit packs. */
  plan: PlanSchema.optional(),
  credits: z.number().optional(),
  interval: z.enum(["month", "year"]).optional(),
  days: z.number().optional(),
  priceCents: z.number(),
  currency: z.string(),
  available: z.boolean(),
});
export type OfferDto = z.output<typeof OfferSchema>;

export const BillingStatusSchema = z.object({
  plan: PlanSchema,
  source: z.enum(["base", "subscription", "pass"]),
  subscription: z
    .object({ plan: PlanSchema, status: z.string(), currentPeriodEnd: z.string(), cancelAtPeriodEnd: z.boolean() })
    .nullable(),
  pass: z.object({ plan: PlanSchema, endsAt: z.string() }).nullable(),
  canManage: z.boolean(),
});
export type BillingStatusDto = z.output<typeof BillingStatusSchema>;
