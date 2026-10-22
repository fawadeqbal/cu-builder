import Stripe from "stripe";

/** Pays an expert their share (Stripe Connect transfer). Null when payouts can't run. */
export type Payouts = (o: { accountId: string | null; amountCents: number; currency: string; orderId: string }) => Promise<string | null>;

export const PAYOUTS = Symbol.for("cvb.worker.Payouts");

export function stripePayouts(secretKey: string | undefined): Payouts {
  if (!secretKey) return async () => null;
  const stripe = new Stripe(secretKey);
  return async ({ accountId, amountCents, currency, orderId }) => {
    if (!accountId || amountCents <= 0) return null;
    const t = await stripe.transfers.create(
      { amount: amountCents, currency, destination: accountId, transfer_group: orderId, metadata: { orderId } },
      { idempotencyKey: `payout-${orderId}` },
    );
    return t.id;
  };
}
