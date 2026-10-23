import { DEFAULT_PRICES, isCurrency } from "../billing/prices";
import type { OfferId } from "../billing/offers";
import type { Plan } from "../billing/plans";

/**
 * Monthly recurring revenue. Yearly plans count as a twelfth of their price per month; trials,
 * incomplete and cancelled subscriptions count as zero; a subscription in its payment grace
 * period (past_due) still counts until it is cancelled. Amounts are minor units of one
 * currency, and currencies are never added together.
 */

export type BillingInterval = "month" | "year";
export type SubscriptionStatusName = "trialing" | "active" | "past_due" | "canceled" | "incomplete";

export type MrrSubscription = {
  status: SubscriptionStatusName;
  /** What one billing period costs, in minor units; null when the provider didn't say. */
  amountCents: number | null;
  interval: BillingInterval | null;
  plan: Exclude<Plan, "free">;
  currency: string;
};

export const MRR_STATUSES: readonly SubscriptionStatusName[] = ["active", "past_due"];

/** A price per billing period, as a monthly amount (rounded to the minor unit). */
export function monthlyCents(amountCents: number, interval: BillingInterval): number {
  return interval === "year" ? Math.round(amountCents / 12) : amountCents;
}

/** The default list price for a plan and interval in a currency, for subscriptions recorded before amounts were stored. */
export function listPrice(plan: Exclude<Plan, "free">, interval: BillingInterval, currency: string): number {
  const c = isCurrency(currency) ? currency : "usd";
  return DEFAULT_PRICES[c][`${plan}_${interval === "year" ? "yearly" : "monthly"}` as OfferId];
}

/** This subscription's contribution to MRR right now. */
export function subscriptionMrr(s: MrrSubscription | null | undefined): number {
  if (!s || !MRR_STATUSES.includes(s.status)) return 0;
  const interval = s.interval ?? "month";
  return monthlyCents(s.amountCents ?? listPrice(s.plan, interval, s.currency), interval);
}

export type MrrMovementKind = "new" | "expansion" | "contraction" | "churn" | "reactivation";
export const MRR_MOVEMENT_KINDS: readonly MrrMovementKind[] = ["new", "expansion", "contraction", "churn", "reactivation"];

export type MrrMovement = { kind: MrrMovementKind; beforeCents: number; afterCents: number; deltaCents: number };

/**
 * How MRR moved when a subscription changed from `before` to `after` (null `before` = first
 * time we see it). Null when MRR didn't move (a renewal, a card update, a trial starting).
 * A change of currency is a churn in the old one and a new subscription in the new one; the
 * caller records both by calling this per currency.
 */
export function mrrMovement(before: MrrSubscription | null, after: MrrSubscription): MrrMovement | null {
  const b = subscriptionMrr(before);
  const a = subscriptionMrr(after);
  if (a === b) return null;
  let kind: MrrMovementKind;
  if (b === 0) kind = before && before.status !== "trialing" && before.status !== "incomplete" ? "reactivation" : "new";
  else if (a === 0) kind = "churn";
  else kind = a > b ? "expansion" : "contraction";
  return { kind, beforeCents: b, afterCents: a, deltaCents: a - b };
}

/** Movements for a change that may switch currency: one per affected currency. */
export function mrrMovements(before: MrrSubscription | null, after: MrrSubscription): (MrrMovement & { currency: string })[] {
  if (before && before.currency !== after.currency) {
    const out: (MrrMovement & { currency: string })[] = [];
    const gone = mrrMovement(before, { ...before, status: "canceled" });
    if (gone) out.push({ ...gone, currency: before.currency });
    const added = mrrMovement(null, after);
    if (added) out.push({ ...added, currency: after.currency });
    return out;
  }
  const m = mrrMovement(before, after);
  return m ? [{ ...m, currency: after.currency }] : [];
}

/** Sums movements per kind (churn and contraction as positive amounts lost). */
export function summariseMovements(movements: readonly { kind: MrrMovementKind; deltaCents: number }[]) {
  const sum = { new: 0, expansion: 0, contraction: 0, churn: 0, reactivation: 0, net: 0 };
  for (const m of movements) {
    sum[m.kind] += Math.abs(m.deltaCents);
    sum.net += m.deltaCents;
  }
  return sum;
}

/** Revenue churn: MRR lost (churn + contraction) as a share of MRR at the start. Null without a starting MRR. */
export function revenueChurnRate(startMrr: number, lostMrr: number): number | null {
  return startMrr > 0 ? lostMrr / startMrr : null;
}

/** Average revenue per paying user: revenue over the people who paid. */
export function arppu(revenueCents: number, payers: number): number {
  return payers > 0 ? Math.round(revenueCents / payers) : 0;
}
