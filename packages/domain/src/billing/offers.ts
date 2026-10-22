import { atLeast, type Plan } from "./plans";

/**
 * What can be bought. Prices are defaults for display and for creating provider prices;
 * the payment provider remains the source of truth for what is charged.
 */
export type OfferId =
  | "standard_monthly"
  | "standard_yearly"
  | "premium_monthly"
  | "premium_yearly"
  | "executive_monthly"
  | "executive_yearly"
  | "pass_7d"
  | "pass_30d"
  | "credits_100";

export type Offer =
  | { id: OfferId; kind: "subscription"; plan: Exclude<Plan, "free">; interval: "month" | "year"; priceCents: number }
  | { id: OfferId; kind: "pass"; plan: Exclude<Plan, "free">; days: number; priceCents: number }
  /** An AI credit pack: credits that don't expire, on top of the monthly allowance. */
  | { id: OfferId; kind: "credits"; credits: number; priceCents: number };

export const CURRENCY = "usd";

export const OFFERS: readonly Offer[] = [
  { id: "standard_monthly", kind: "subscription", plan: "standard", interval: "month", priceCents: 700 },
  { id: "standard_yearly", kind: "subscription", plan: "standard", interval: "year", priceCents: 5_900 },
  { id: "premium_monthly", kind: "subscription", plan: "premium", interval: "month", priceCents: 1_500 },
  { id: "premium_yearly", kind: "subscription", plan: "premium", interval: "year", priceCents: 12_900 },
  { id: "executive_monthly", kind: "subscription", plan: "executive", interval: "month", priceCents: 3_900 },
  { id: "executive_yearly", kind: "subscription", plan: "executive", interval: "year", priceCents: 34_900 },
  { id: "pass_7d", kind: "pass", plan: "premium", days: 7, priceCents: 900 },
  { id: "pass_30d", kind: "pass", plan: "premium", days: 30, priceCents: 1_900 },
  { id: "credits_100", kind: "credits", credits: 100, priceCents: 500 },
];

export const OFFER_IDS = OFFERS.map((o) => o.id) as [OfferId, ...OfferId[]];

export const offerById = (id: OfferId): Offer => {
  const offer = OFFERS.find((o) => o.id === id);
  if (!offer) throw new Error(`Unknown offer ${id}`);
  return offer;
};

export type SubscriptionState = {
  plan: Plan;
  status: "trialing" | "active" | "past_due" | "canceled" | "incomplete";
  currentPeriodEnd: Date;
};

export type PassState = { plan: Plan; startsAt: Date; endsAt: Date };

export type PlanSource = "base" | "subscription" | "pass";

/**
 * The plan a user actually has right now: the best of their base plan, any subscription that
 * is paid up (or in its grace period) and any pass that is running.
 */
export function effectivePlan(
  input: { base: Plan; subscriptions: SubscriptionState[]; passes: PassState[] },
  now: Date = new Date(),
): { plan: Plan; source: PlanSource } {
  let best: { plan: Plan; source: PlanSource } = { plan: input.base, source: "base" };
  const consider = (plan: Plan, source: PlanSource) => {
    if (!atLeast(best.plan, plan)) best = { plan, source };
  };
  for (const s of input.subscriptions) {
    const live = s.status === "active" || s.status === "trialing" || s.status === "past_due";
    if (live && s.currentPeriodEnd > now) consider(s.plan, "subscription");
  }
  for (const p of input.passes) {
    if (p.startsAt <= now && p.endsAt > now) consider(p.plan, "pass");
  }
  return best;
}
