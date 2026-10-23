"use client";

import type { OfferDto, RedirectDto } from "@cvb/contracts";
import { yearlySaving, type Currency, type Plan } from "@cvb/domain";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Alert, Badge, Button, Icon, SegmentedControl, type IconName } from "@cvb/ui";
import { track } from "@/lib/analytics";
import { api } from "@/lib/api";
import { CURRENCY_LABEL, CURRENCY_NAME, useCurrency, useOfferPrices } from "@/lib/currency";
import { formatPrice, PLAN_LABEL, PLAN_POINTS } from "@/lib/plans";
import { useBillingStatus, useMe } from "@/lib/queries";
import { AppHeader } from "../AppHeader";
import { WhatsAppHelp } from "../trust/WhatsAppHelp";
import { useT } from "@/lib/i18n";

const PAID: Exclude<Plan, "free">[] = ["standard", "premium", "executive"];

/** Plans with a yearly discount and Job-Hunt Passes, priced and paid in US dollars or rupees. */
export function PricingPage() {
  const t = useT();
  const params = useSearchParams();
  const router = useRouter();
  const me = useMe();
  const [currency, setCurrency] = useCurrency();
  const offers = useOfferPrices(currency);
  const billing = useBillingStatus(Boolean(me.data));
  const [interval, setBillingInterval] = useState<"month" | "year">("year");
  const highlight = (params.get("plan") as Plan | null) ?? "premium";
  const cancelled = params.get("checkout") === "cancelled";
  const highlightParam = params.get("plan");
  useEffect(() => {
    track("pricing_viewed", { ...(highlightParam ? { plan: highlightParam.slice(0, 20) } : {}), returnedFromCheckout: cancelled });
  }, [highlightParam, cancelled]);

  const checkout = useMutation({
    mutationFn: (offer: OfferDto) =>
      api.post<RedirectDto>("/billing/checkout", { offer: offer.id, currency: offer.currency }),
    onMutate: (offer) => track("checkout_started", { offer: offer.id, currency: offer.currency, kind: offer.kind }),
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
  const subFor = (plan: Plan, every: "month" | "year" = interval) =>
    list.find((o) => o.kind === "subscription" && o.plan === plan && o.interval === every);
  const passes = list.filter((o) => o.kind === "pass");
  const packs = list.filter((o) => o.kind === "credits");
  // Only signed-in people have a current plan; visitors see the free plan as "included".
  const current = me.data?.plan ?? null;
  const hasSubscription = Boolean(billing.data?.subscription);
  const bestSaving = Math.max(0, ...PAID.map((p) => yearlySaving(subFor(p, "month")?.priceCents ?? 0, subFor(p, "year")?.priceCents ?? 0)));
  const busy = checkout.isPending || portal.isPending;

  function buy(offer: OfferDto) {
    if (!me.data) {
      const next = offer.kind === "pass" ? "/pricing#pass" : `/pricing?plan=${offer.plan ?? "premium"}`;
      return router.push(`/sign-up?next=${encodeURIComponent(next)}`);
    }
    if (offer.kind === "subscription" && hasSubscription && billing.data?.canManage) return portal.mutate();
    checkout.mutate(offer);
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-(--layout-lg) flex-col gap-10 px-4 pb-20 pt-10 sm:gap-14 sm:px-6 sm:pt-16">
        <header className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
          <div className="flex flex-col gap-3">
            <h1 className="font-display text-[32px]/[38px] font-bold tracking-tight text-balance text-ink sm:text-[38px]/[44px]">
              {t("pricing.title")}
            </h1>
            <p className="text-base text-ink-2">{t("pricing.subtitle")}</p>
          </div>

          {cancelled && <Alert className="w-full max-w-md text-start">{t("pricing.cancelled")}</Alert>}
          {(checkout.error || portal.error) && (
            <Alert tone="danger" className="w-full max-w-md text-start">
              {(checkout.error ?? portal.error)?.message}
            </Alert>
          )}

          <div className="flex max-w-full flex-wrap items-center justify-center gap-3">
            <SegmentedControl<Currency>
              label={t("pricing.currency")}
              value={currency}
              onChange={setCurrency}
              options={[
                { value: "pkr", label: CURRENCY_LABEL.pkr },
                { value: "usd", label: CURRENCY_LABEL.usd },
              ]}
            />
            <SegmentedControl
              label={t("pricing.period")}
              value={interval}
              onChange={setBillingInterval}
              options={[
                { value: "month", label: t("pricing.monthly") },
                {
                  value: "year",
                  label: bestSaving > 0 ? t("pricing.yearlySave", { pct: bestSaving }) : t("pricing.yearlyOnly"),
                },
              ]}
            />
          </div>
        </header>

        <TrustLine />

        <PassBand passes={passes} busy={busy} onBuy={buy} />

        <section aria-labelledby="plans-heading" className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h2 id="plans-heading" className="cvb-h2">
              {t("pricing.plansTitle")}
            </h2>
            <p className="text-ink-2">{t("pricing.plansDesc")}</p>
          </div>
          <div className="grid gap-6 pt-3 md:grid-cols-2 lg:grid-cols-4">
            <PlanCard plan="free" price={formatPrice(0, currency)} note={t("pricing.forever")} current={current === "free"} highlight={false}>
              <Button block disabled>
                {me.data ? t("pricing.yourPlan") : t("pricing.included")}
              </Button>
            </PlanCard>
            {PAID.map((plan) => {
              const offer = subFor(plan);
              const m = subFor(plan, "month");
              const yearly = offer?.interval === "year";
              const perMonth = offer ? (yearly ? offer.priceCents / 12 : offer.priceCents) : 0;
              const saving = offer && m && yearly ? yearlySaving(m.priceCents, offer.priceCents) : 0;
              return (
                <PlanCard
                  key={plan}
                  plan={plan}
                  price={offer ? formatPrice(roundMinor(perMonth, currency), offer.currency) : "…"}
                  note={
                    offer && yearly
                      ? t(saving ? "pricing.billedYearlySave" : "pricing.billedYearly", {
                          total: formatPrice(offer.priceCents, offer.currency),
                          pct: saving,
                        })
                      : t("pricing.aMonth")
                  }
                  current={current === plan}
                  highlight={highlight === plan}
                >
                  <Button
                    block
                    variant={highlight === plan ? "primary" : "secondary"}
                    disabled={!offer?.available || busy || current === plan}
                    onClick={() => offer && buy(offer)}
                  >
                    {current === plan
                      ? t("pricing.yourPlan")
                      : !offer?.available
                        ? t("pricing.comingSoon")
                        : hasSubscription
                          ? t("pricing.changePlan")
                          : `Get ${PLAN_LABEL[plan]}`}
                  </Button>
                </PlanCard>
              );
            })}
          </div>
        </section>

        {packs.length > 0 && (
          <section
            id="credits"
            className="cvb-card grid scroll-mt-20 gap-6 p-5 sm:p-6 md:grid-cols-[1.2fr_2fr] md:items-center"
          >
            <div className="flex flex-col gap-1">
              <h2 className="cvb-h2">{t("pricing.credits")}</h2>
              <p className="text-ink-2">{t("pricing.creditsDesc")}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {packs.map((p) => (
                <OfferTile key={p.id} name={`${p.credits} credits`} price={t("pricing.once", { price: formatPrice(p.priceCents, p.currency) })}>
                  <Button size="sm" disabled={!p.available || busy} onClick={() => buy(p)}>
                    {p.available ? t("pricing.buy") : t("pricing.soon")}
                  </Button>
                </OfferTile>
              ))}
            </div>
          </section>
        )}

        <p className="cvb-caption mx-auto max-w-2xl text-center">{t("pricing.footnote", { currency: CURRENCY_NAME[currency] })}</p>
      </main>
      <WhatsAppHelp />
    </div>
  );
}

/** Whole rupees, or cents for dollars, when a yearly price is shown per month. */
const roundMinor = (amount: number, currency: Currency) => (currency === "pkr" ? Math.round(amount / 100) * 100 : Math.round(amount));

/** What people worry about before paying, answered plainly. */
function TrustLine() {
  const t = useT();
  const items: [IconName, string][] = [
    ["check-circle", t("pricing.trustTrials")],
    ["clock", t("pricing.trustPasses")],
    ["undo", t("pricing.trustCancel")],
  ];
  return (
    <ul aria-label={t("pricing.trustLabel")} className="mx-auto grid w-full max-w-4xl gap-3 sm:grid-cols-3">
      {items.map(([icon, text]) => (
        <li key={icon} className="flex items-start gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-2">
          <Icon name={icon} size={18} className="mt-0.5 shrink-0 text-success" />
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}

/** The Job-Hunt Pass, up front: the simplest choice for students and a few weeks of applying. */
function PassBand({ passes, busy, onBuy }: { passes: OfferDto[]; busy: boolean; onBuy: (o: OfferDto) => void }) {
  const t = useT();
  return (
    <section
      id="pass"
      aria-labelledby="pass-heading"
      className="grid scroll-mt-20 gap-6 rounded-xl border border-gold bg-gold-soft p-5 sm:p-7 md:grid-cols-[1.1fr_1.6fr] md:items-center"
    >
      <div className="flex flex-col items-start gap-3">
        <Badge tone="highlight" variant="solid" pill icon="star">
          {t("pricing.passBadge")}
        </Badge>
        <h2 id="pass-heading" className="cvb-h2 text-ink">
          {t("pricing.pass")}
        </h2>
        <p className="text-gold-ink">{t("pricing.passDesc")}</p>
        <ul className="flex flex-col gap-1.5 text-sm text-gold-ink">
          {[t("pricing.passPoint1"), t("pricing.passPoint2"), t("pricing.passPoint3")].map((p) => (
            <li key={p} className="flex items-start gap-2">
              <Icon name="check" size={16} className="mt-0.5 shrink-0" /> {p}
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {passes.length === 0
          ? [0, 1].map((i) => <div key={i} className="h-28 animate-pulse rounded-lg bg-surface/60" aria-hidden="true" />)
          : passes.map((p) => (
              <div key={p.id} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 text-ink">
                <div className="flex flex-col">
                  <span className="cvb-overline">{t("pricing.passDays", { days: p.days ?? 0 })}</span>
                  <span className="font-display text-[28px]/[34px] font-bold tracking-tight [font-variant-numeric:lining-nums]" dir="ltr">
                    {formatPrice(p.priceCents, p.currency)}
                  </span>
                  <span className="cvb-caption">{t("pricing.passOnce")}</span>
                </div>
                <Button variant={p.days === 30 ? "primary" : "secondary"} block disabled={!p.available || busy} onClick={() => onBuy(p)}>
                  {p.available ? t("pricing.buyPass") : t("pricing.soon")}
                </Button>
              </div>
            ))}
      </div>
    </section>
  );
}

function PlanCard({
  plan,
  price,
  note,
  current,
  highlight,
  children,
}: {
  plan: Plan;
  price: string;
  note: string;
  current: boolean;
  highlight: boolean;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <div className="cvb-pricing" data-featured={highlight ? "" : undefined}>
      {highlight && (
        <span className="cvb-pricing-flag">
          <Badge tone="highlight" variant="solid" pill icon="star">
            {t("pricing.recommended")}
          </Badge>
        </span>
      )}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="cvb-h3">{PLAN_LABEL[plan]}</h3>
          {current && (
            <Badge tone="success" icon="check-circle">
              {t("pricing.current")}
            </Badge>
          )}
        </div>
        <div className="cvb-pricing-price flex-wrap">
          <span className="cvb-pricing-amount [font-variant-numeric:lining-nums]" dir="ltr">
            {price}
          </span>
          <span className="cvb-caption">{note}</span>
        </div>
      </div>
      {children}
      <ul className="cvb-pricing-list">
        {PLAN_POINTS[plan].map((p) => (
          <li key={p}>
            <Icon name="check" size={16} /> {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

function OfferTile({ name, price, children }: { name: string; price: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 p-4">
      <div className="flex flex-col">
        <span className="cvb-price">{name}</span>
        <span className="cvb-caption cvb-num">{price}</span>
      </div>
      {children}
    </div>
  );
}
