"use client";

import type { OfferDto } from "@cvb/contracts";
import { DEFAULT_CURRENCY, isCurrency, type Currency } from "@cvb/domain";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import { track } from "./analytics";
import { api } from "./api";
import { keys } from "./queries";

export type { Currency };

const STORAGE_KEY = "cvb-currency";

export const CURRENCY_LABEL: Record<Currency, string> = { usd: "USD", pkr: "PKR" };
export const CURRENCY_NAME: Record<Currency, string> = { usd: "US dollars", pkr: "Pakistani rupees" };

/**
 * The currency to start with: rupees for people in Pakistan (time zone Asia/Karachi) or using
 * Urdu or a Pakistani locale ("ur", "en-PK"), dollars for everyone else.
 */
export function detectCurrency(env: { timeZone?: string | null; languages?: readonly (string | null | undefined)[] }): Currency {
  if (env.timeZone === "Asia/Karachi") return "pkr";
  for (const raw of env.languages ?? []) {
    const tag = (raw ?? "").trim().toLowerCase().replace(/_/g, "-");
    if (tag === "ur" || tag.startsWith("ur-") || tag.endsWith("-pk")) return "pkr";
  }
  return "usd";
}

// One shared store so every component using the hook sees the same choice.
const listeners = new Set<() => void>();
let chosen: Currency | null = null;
let detected: Currency | null = null;

function browserDefault(): Currency {
  if (detected) return detected;
  let timeZone: string | null = null;
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    // Old browsers: languages decide.
  }
  detected = detectCurrency({
    timeZone,
    languages: [document.documentElement.lang, ...(navigator.languages ?? []), navigator.language],
  });
  return detected;
}

function snapshot(): Currency {
  if (chosen) return chosen;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isCurrency(saved)) return (chosen = saved);
  } catch {
    // Storage blocked (private mode, settings): fall back to detection.
  }
  return browserDefault();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    chosen = isCurrency(e.newValue) ? e.newValue : null;
    onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** The server (and the first client render) always uses the default, so hydration matches. */
const serverSnapshot = (): Currency => DEFAULT_CURRENCY;

/**
 * The currency prices are shown and charged in: `[currency, setCurrency]`. Starts from the
 * browser's time zone and language, then remembers the person's choice on this device.
 */
export function useCurrency(): [Currency, (next: Currency) => void] {
  const currency = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const setCurrency = useCallback((next: Currency) => {
    const before = snapshot();
    if (before !== next) track("currency_switched", { from: before, to: next });
    chosen = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not remembered across visits; still applies now.
    }
    for (const l of listeners) l();
  }, []);
  return [currency, setCurrency];
}

/** Offers priced in `currency` (defaults or the admin's prices). */
export const useOfferPrices = (currency: Currency) =>
  useQuery({
    queryKey: [...keys.offers, currency],
    queryFn: () => api.get<OfferDto[]>(`/billing/offers?currency=${currency}`),
    staleTime: 300_000,
  });
