"use client";

import type { PriceSettingDto } from "@cvb/contracts";
import { CURRENCIES, OFFERS, checkPrice, type Currency, type Offer, type OfferId } from "@cvb/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, DataTable, Skeleton, TextField } from "@cvb/ui";
import { api } from "@/lib/api";
import { CURRENCY_LABEL } from "@/lib/currency";
import { formatPrice, PLAN_LABEL } from "@/lib/plans";
import { keys } from "@/lib/queries";

const KEY = ["admin", "prices"] as const;
const SYMBOL: Record<Currency, string> = { usd: "$", pkr: "Rs" };

const offerName = (o: Offer): string =>
  o.kind === "subscription"
    ? `${PLAN_LABEL[o.plan]}, ${o.interval === "month" ? "monthly" : "yearly"}`
    : o.kind === "pass"
      ? `Job-Hunt Pass, ${o.days} days`
      : `${o.credits} AI credits`;

/** "990" or "19.50" → minor units; null when it isn't a number. */
const toMinor = (text: string): number | null => {
  const n = Number(text.replace(/[,\s]/g, ""));
  return text.trim() && Number.isFinite(n) ? Math.round(n * 100) : null;
};
const toMajor = (amount: number): string => (amount % 100 ? (amount / 100).toFixed(2) : String(amount / 100));

/**
 * Site admin: the price of every offer in every currency. Defaults come from the code; a
 * changed price applies to new checkouts at once (running subscriptions keep their price).
 */
export function PricingAdmin() {
  const qc = useQueryClient();
  const prices = useQuery({ queryKey: KEY, queryFn: () => api.get<PriceSettingDto[]>("/admin/prices") });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const done = () => {
    void qc.invalidateQueries({ queryKey: KEY });
    void qc.invalidateQueries({ queryKey: keys.offers });
  };
  const fail = (id: string) => (e: Error) => setErrors((x) => ({ ...x, [id]: e.message }));
  const save = useMutation({
    mutationFn: ({ offer, currency, amount }: { offer: OfferId; currency: Currency; amount: number }) =>
      api.put<PriceSettingDto>(`/admin/prices/${offer}/${currency}`, { amount }),
    onSuccess: done,
  });
  const reset = useMutation({
    mutationFn: ({ offer, currency }: { offer: OfferId; currency: Currency }) => api.delete(`/admin/prices/${offer}/${currency}`),
    onSuccess: done,
  });

  if (prices.error) return <Alert tone="danger">{prices.error.message}</Alert>;
  if (!prices.data) return <Skeleton height={320} shape="block" />;
  const byKey = new Map(prices.data.map((p) => [`${p.offer}:${p.currency}`, p]));
  const overridden = prices.data.filter((p) => p.overridden).length;

  function commit(offer: OfferId, currency: Currency, text: string, current: PriceSettingDto) {
    const id = `${offer}:${currency}`;
    const amount = toMinor(text);
    if (amount === null) return setErrors((x) => ({ ...x, [id]: "Enter a number" }));
    const problem = checkPrice(currency, amount);
    if (problem) return setErrors((x) => ({ ...x, [id]: problem }));
    setErrors(({ [id]: _, ...rest }) => rest);
    if (amount === current.amount) return;
    if (amount === current.defaultAmount && current.overridden) return reset.mutate({ offer, currency }, { onError: fail(id) });
    save.mutate({ offer, currency, amount }, { onError: fail(id) });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-2">
        Prices for new checkouts, in each currency. People who already subscribed keep paying what they agreed to.{" "}
        {overridden > 0 ? `${overridden} ${overridden === 1 ? "price is" : "prices are"} changed from the default.` : "All prices are the defaults."}
      </p>
      <DataTable<Offer>
        caption="Prices"
        rows={[...OFFERS]}
        rowKey={(o) => o.id}
        columns={[
          {
            key: "offer",
            label: "Offer",
            render: (o) => (
              <div className="flex min-w-40 flex-col">
                <span className="text-ink">{offerName(o)}</span>
                <span className="cvb-caption font-normal">{o.kind === "subscription" ? "Subscription" : "Paid once"}</span>
              </div>
            ),
          },
          ...CURRENCIES.map((currency) => ({
            key: currency,
            label: CURRENCY_LABEL[currency],
            render: (o: Offer) => {
              const p = byKey.get(`${o.id}:${currency}`);
              if (!p) return null;
              const id = `${o.id}:${currency}`;
              return (
                <div className="flex min-w-44 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <TextField
                      // Re-mount when the saved amount changes so the field shows it.
                      key={p.amount}
                      size="sm"
                      inputMode="decimal"
                      inputClassName="py-1 tabular-nums"
                      className="w-32"
                      dir="ltr"
                      prefix={SYMBOL[currency]}
                      aria-label={`${offerName(o)} price in ${CURRENCY_LABEL[currency]}`}
                      aria-invalid={errors[id] ? true : undefined}
                      defaultValue={toMajor(p.amount)}
                      onBlur={(e) => commit(o.id, currency, e.target.value, p)}
                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                    />
                    {p.overridden && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon="undo"
                        loading={reset.isPending && reset.variables?.offer === o.id && reset.variables.currency === currency}
                        onClick={() => reset.mutate({ offer: o.id, currency }, { onError: fail(id) })}
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                  <span className="cvb-caption flex flex-wrap items-center gap-1.5 font-normal">
                    {p.overridden ? (
                      <>
                        <Badge tone="info">Custom</Badge>
                        <span>
                          Default {formatPrice(p.defaultAmount, currency)}
                          {p.updatedBy ? ` · by ${p.updatedBy}` : ""}
                          {p.updatedAt ? `, ${new Date(p.updatedAt).toLocaleDateString()}` : ""}
                        </span>
                      </>
                    ) : (
                      "Default"
                    )}
                  </span>
                  {errors[id] && (
                    <span className="text-xs font-normal text-danger" role="alert">
                      {errors[id]}
                    </span>
                  )}
                </div>
              );
            },
          })),
        ]}
      />
    </div>
  );
}
