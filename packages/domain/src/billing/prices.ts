import { OFFERS, type Offer, type OfferId } from "./offers";

/**
 * Prices per currency. Amounts are in the currency's minor unit, as Stripe expects them
 * (cents for USD, paisa for PKR: both have two decimals, so Rs 990 is 99_000).
 * Defaults live here; an admin can override any offer in any currency (PriceSetting rows).
 */
export const CURRENCIES = ["usd", "pkr"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const DEFAULT_CURRENCY: Currency = "usd";

export const isCurrency = (v: unknown): v is Currency =>
  typeof v === "string" && (CURRENCIES as readonly string[]).includes(v);

const USD = Object.fromEntries(OFFERS.map((o) => [o.id, o.priceCents])) as Record<OfferId, number>;

/** Rupees → paisa. */
const rs = (rupees: number) => rupees * 100;

export const DEFAULT_PRICES: Record<Currency, Record<OfferId, number>> = {
  usd: USD,
  pkr: {
    standard_monthly: rs(990),
    standard_yearly: rs(9_900),
    premium_monthly: rs(1_990),
    premium_yearly: rs(19_900),
    executive_monthly: rs(4_990),
    executive_yearly: rs(49_900),
    pass_7d: rs(690),
    pass_30d: rs(1_490),
    credits_100: rs(590),
  },
};

/**
 * Bounds an admin may set. The floor keeps clear of Stripe's minimum charge (about 50 US cents
 * after conversion); the ceiling is Stripe's eight-digit amount limit.
 */
export const PRICE_BOUNDS: Record<Currency, { min: number; max: number }> = {
  usd: { min: 50, max: 99_999_999 },
  pkr: { min: rs(200), max: 99_999_999 },
};

export type PriceOverride = { offer: OfferId; currency: Currency; amount: number };

export type ResolvedPrice = {
  offer: OfferId;
  currency: Currency;
  amount: number;
  defaultAmount: number;
  overridden: boolean;
};

/** The price of one offer in one currency: the admin's override if there is one, else the default. */
export function resolvePrice(offer: OfferId, currency: Currency, overrides: readonly PriceOverride[] = []): ResolvedPrice {
  const defaultAmount = DEFAULT_PRICES[currency][offer];
  const override = overrides.find((o) => o.offer === offer && o.currency === currency);
  const valid = override && checkPrice(currency, override.amount) === null;
  return { offer, currency, amount: valid ? override.amount : defaultAmount, defaultAmount, overridden: Boolean(valid) };
}

/** Every offer priced in `currency` (the offer's `priceCents` becomes that currency's minor units). */
export function offersIn(currency: Currency, overrides: readonly PriceOverride[] = []): Offer[] {
  return OFFERS.map((o) => ({ ...o, priceCents: resolvePrice(o.id, currency, overrides).amount }));
}

/** Every offer × currency, for the admin price table. */
export function priceTable(overrides: readonly PriceOverride[] = []): ResolvedPrice[] {
  return OFFERS.flatMap((o) => CURRENCIES.map((c) => resolvePrice(o.id, c, overrides)));
}

/** Null when `amount` (minor units) is a price that can be charged; otherwise why not. */
export function checkPrice(currency: Currency, amount: number): string | null {
  const { min, max } = PRICE_BOUNDS[currency];
  if (!Number.isInteger(amount)) return "Use whole minor units (cents or paisa)";
  if (amount < min) return `The lowest price is ${formatMinor(min, currency)}`;
  if (amount > max) return `The highest price is ${formatMinor(max, currency)}`;
  return null;
}

/** "Rs 990" / "$7" style text for messages (the web app formats with Intl). */
export function formatMinor(amount: number, currency: Currency): string {
  const major = amount / 100;
  const text = Number.isInteger(major) ? major.toLocaleString("en") : major.toFixed(2);
  return currency === "pkr" ? `Rs ${text}` : `$${text}`;
}

/** The percentage saved by paying yearly instead of twelve monthly payments (0 when none). */
export function yearlySaving(monthly: number, yearly: number): number {
  if (monthly <= 0) return 0;
  return Math.max(0, Math.round((1 - yearly / (monthly * 12)) * 100));
}
