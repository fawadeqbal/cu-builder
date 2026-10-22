"use client";

import type { OfferDto, RedirectDto } from "@cvb/contracts";
import type { OfferId, Plan } from "@cvb/domain";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { CheckIcon } from "@cvb/ui";
import { track } from "@/lib/analytics";
import { api } from "@/lib/api";
import { formatPrice, PLAN_LABEL, PLAN_POINTS } from "@/lib/plans";
import { useBillingStatus, useMe, useOffers } from "@/lib/queries";
import { AppHeader } from "../AppHeader";
import { btn, card } from "../ui/styles";

const PAID: Exclude<Plan, "free">[] = ["standard", "premium", "executive"];
type Provider = "stripe" | "local";

/** Plans, yearly discount and Job-Hunt Passes, with checkout through the chosen payment method. */
export function PricingPage() {
  const params = useSearchParams();
  const router = useRouter();
  const me = useMe();
  const offers = useOffers();
  const billing = useBillingStatus(Boolean(me.data));
  const [interval, setBillingInterval] = useState<"month" | "year">("year");
  const [provider, setProvider] = useState<Provider>("stripe");
  const highlight = (params.get("plan") as Plan | null) ?? "premium";
  const cancelled = params.get("checkout") === "cancelled";

  const checkout = useMutation({
    mutationFn: (offer: OfferId) => api.post<RedirectDto>("/billing/checkout", { offer, provider }),
    onMutate: (offer) => track("checkout_started", { offer, provider }),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });
  const portal = useMutation({
    mutationFn: () => api.post<RedirectDto>("/billing/portal"),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });

  const list = offers.data ?? [];
  const subFor = (plan: Plan) => list.find((o) => o.kind === "subscription" && o.plan === plan && o.interval === interval);
  const monthly = (plan: Plan) => list.find((o) => o.kind === "subscription" && o.plan === plan && o.interval === "month");
  const passes = list.filter((o) => o.kind === "pass");
  const packs = list.filter((o) => o.kind === "credits");
  const current = me.data?.plan ?? "free";
  const hasSubscription = Boolean(billing.data?.subscription);
  const localAvailable = false; // the local gateway is not connected yet (see BillingModule)

  function buy(offer: OfferDto) {
    if (!me.data) return router.push(`/sign-up?next=${encodeURIComponent(`/pricing?plan=${offer.plan ?? "premium"}`)}`);
    if (offer.kind === "subscription" && hasSubscription && billing.data?.canManage) return portal.mutate();
    checkout.mutate(offer.id);
  }

  return (
    <div className="min-h-dvh bg-stone-50">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">Simple plans for every job search</h1>
          <p className="mt-3 text-[15px] text-stone-600">Start free. Upgrade when you need more, or buy a pass for just the weeks you&apos;re applying.</p>
        </div>

        {cancelled && <p className="mx-auto mt-6 max-w-md rounded-lg bg-stone-100 px-4 py-2 text-center text-sm text-stone-600">Checkout was cancelled. Nothing was charged.</p>}
        {checkout.error && <p className="mx-auto mt-6 max-w-md rounded-lg bg-red-50 px-4 py-2 text-center text-sm text-red-700">{checkout.error.message}</p>}

        <div className="mt-8 flex flex-col items-center gap-3">
          <div role="radiogroup" aria-label="Billing period" className="flex rounded-full bg-white p-1 text-sm shadow-xs ring-1 ring-stone-200">
            {(["month", "year"] as const).map((i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={interval === i}
                onClick={() => setBillingInterval(i)}
                className={`rounded-full px-4 py-1.5 font-medium ${interval === i ? "bg-stone-900 text-white" : "text-stone-600"}`}
              >
                {i === "month" ? "Monthly" : "Yearly · save up to 30%"}
              </button>
            ))}
          </div>
          <div role="radiogroup" aria-label="Payment method" className="flex flex-wrap justify-center gap-2 text-xs">
            <button type="button" role="radio" aria-checked={provider === "stripe"} onClick={() => setProvider("stripe")} className={`rounded-full px-3 py-1 font-medium ring-1 ${provider === "stripe" ? "bg-brand/10 text-brand ring-brand/30" : "text-stone-500 ring-stone-200"}`}>
              Card (Visa, Mastercard)
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={provider === "local"}
              disabled={!localAvailable}
              onClick={() => setProvider("local")}
              title={localAvailable ? undefined : "Coming soon"}
              className="rounded-full px-3 py-1 font-medium text-stone-400 ring-1 ring-stone-200 disabled:cursor-not-allowed"
            >
              JazzCash / Easypaisa · coming soon
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-4">
          <PlanCard plan="free" price="$0" note="forever" current={current === "free"} highlight={false}>
            <span className={`${btn.secondary} w-full`}>{me.data ? "Your plan" : "Included"}</span>
          </PlanCard>
          {PAID.map((plan) => {
            const offer = subFor(plan);
            const m = monthly(plan);
            const perMonth = offer ? (offer.interval === "year" ? offer.priceCents / 12 : offer.priceCents) : 0;
            const saving = offer && m && offer.interval === "year" ? Math.round((1 - offer.priceCents / (m.priceCents * 12)) * 100) : 0;
            return (
              <PlanCard
                key={plan}
                plan={plan}
                price={offer ? formatPrice(Math.round(perMonth), offer.currency) : "…"}
                note={offer?.interval === "year" ? `a month, ${formatPrice(offer.priceCents, offer.currency)} billed yearly${saving ? ` (save ${saving}%)` : ""}` : "a month"}
                current={current === plan}
                highlight={highlight === plan}
              >
                <button
                  type="button"
                  className={`${highlight === plan ? btn.primary : btn.dark} w-full`}
                  disabled={!offer?.available || checkout.isPending || portal.isPending || current === plan}
                  onClick={() => offer && buy(offer)}
                >
                  {current === plan ? "Your plan" : !offer?.available ? "Payments coming soon" : hasSubscription ? "Change plan" : `Get ${PLAN_LABEL[plan]}`}
                </button>
              </PlanCard>
            );
          })}
        </div>

        <section className={`${card} mt-10 grid gap-6 p-6 md:grid-cols-[1.2fr_2fr] md:items-center`}>
          <div>
            <h2 className="text-lg font-semibold text-stone-900">Job-Hunt Pass</h2>
            <p className="mt-1 text-sm text-stone-600">
              Everything in Premium for a set time, paid once. No subscription to remember to cancel.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {passes.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 p-4 ring-1 ring-stone-200">
                <div>
                  <div className="text-sm font-semibold text-stone-900">{p.days} days</div>
                  <div className="text-xs text-stone-500">{formatPrice(p.priceCents, p.currency)} once</div>
                </div>
                <button type="button" className={btn.secondary} disabled={!p.available || checkout.isPending} onClick={() => buy(p)}>
                  {p.available ? "Buy pass" : "Soon"}
                </button>
              </div>
            ))}
          </div>
        </section>

        {packs.length > 0 && (
          <section id="credits" className={`${card} mt-4 grid scroll-mt-20 gap-6 p-6 md:grid-cols-[1.2fr_2fr] md:items-center`}>
            <div>
              <h2 className="text-lg font-semibold text-stone-900">AI credit packs</h2>
              <p className="mt-1 text-sm text-stone-600">Extra credits on top of your monthly allowance. They never expire and are used after the monthly ones.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {packs.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 p-4 ring-1 ring-stone-200">
                  <div>
                    <div className="text-sm font-semibold text-stone-900">{p.credits} credits</div>
                    <div className="text-xs text-stone-500">{formatPrice(p.priceCents, p.currency)} once</div>
                  </div>
                  <button type="button" className={btn.secondary} disabled={!p.available || checkout.isPending} onClick={() => buy(p)}>
                    {p.available ? "Buy" : "Soon"}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="mt-8 text-center text-xs text-stone-500">
          Prices in US dollars. Cancel any time; you keep your plan until the end of the period you paid for. Every template stays free to preview.
        </p>
      </main>
    </div>
  );
}

function PlanCard({ plan, price, note, current, highlight, children }: { plan: Plan; price: string; note: string; current: boolean; highlight: boolean; children: ReactNode }) {
  return (
    <div className={`relative flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-xs ring-1 ${highlight ? "ring-2 ring-brand" : "ring-stone-200"}`}>
      {highlight && <span className="absolute -top-3 left-6 rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-semibold text-white">Recommended</span>}
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-stone-900">{PLAN_LABEL[plan]}</h2>
          {current && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">Current</span>}
        </div>
        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="text-3xl font-semibold tracking-tight text-stone-900">{price}</span>
          <span className="text-xs text-stone-500">{note}</span>
        </div>
      </div>
      {children}
      <ul className="flex flex-col gap-2 text-sm text-stone-700">
        {PLAN_POINTS[plan].map((p) => (
          <li key={p} className="flex items-start gap-2">
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600" /> {p}
          </li>
        ))}
      </ul>
    </div>
  );
}
