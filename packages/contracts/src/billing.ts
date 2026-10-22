import { CURRENCIES, DEFAULT_CURRENCY, OFFER_IDS, PLANS } from "@cvb/domain";
import { z } from "zod";

export const PlanSchema = z.enum(PLANS);

/** "usd" or "pkr" (lower case, as Stripe uses them). */
export const CurrencySchema = z.enum(CURRENCIES);
export type CurrencyDto = z.output<typeof CurrencySchema>;

export const OffersQuerySchema = z.object({ currency: CurrencySchema.default(DEFAULT_CURRENCY) });
export type OffersQuery = z.output<typeof OffersQuerySchema>;

export const CheckoutSchema = z.object({
  offer: z.enum(OFFER_IDS),
  provider: z.enum(["stripe", "local"]).default("stripe"),
  /** Charged in this currency at the price shown for it. */
  currency: CurrencySchema.default(DEFAULT_CURRENCY),
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
  /** In the currency's minor unit (cents, paisa), whatever the currency. */
  priceCents: z.number(),
  currency: z.string(),
  available: z.boolean(),
});
export type OfferDto = z.output<typeof OfferSchema>;

/** Admin: one offer's price in one currency (override or default). */
export const PriceSettingSchema = z.object({
  offer: z.enum(OFFER_IDS),
  currency: CurrencySchema,
  /** Minor units. */
  amount: z.number().int(),
  defaultAmount: z.number().int(),
  overridden: z.boolean(),
  updatedAt: z.string().nullable(),
  /** Who last changed it (name or email), when overridden. */
  updatedBy: z.string().nullable(),
});
export type PriceSettingDto = z.output<typeof PriceSettingSchema>;

export const PriceParamsSchema = z.object({ offer: z.enum(OFFER_IDS), currency: CurrencySchema });
export type PriceParams = z.output<typeof PriceParamsSchema>;

export const UpdatePriceSchema = z.object({ amount: z.number().int().positive().max(99_999_999) });
export type UpdatePriceDto = z.output<typeof UpdatePriceSchema>;

export const BillingStatusSchema = z.object({
  plan: PlanSchema,
  source: z.enum(["base", "subscription", "pass", "organization"]),
  subscription: z
    .object({ plan: PlanSchema, status: z.string(), currentPeriodEnd: z.string(), cancelAtPeriodEnd: z.boolean() })
    .nullable(),
  pass: z.object({ plan: PlanSchema, endsAt: z.string() }).nullable(),
  canManage: z.boolean(),
});
export type BillingStatusDto = z.output<typeof BillingStatusSchema>;
