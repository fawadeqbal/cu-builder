"use client";

import type { OfferDto, RedirectDto } from "@cvb/contracts";
import type { OfferId, Plan } from "@cvb/domain";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Alert, Badge, Button, Chip, Icon, SegmentedControl } from "@cvb/ui";
import { track } from "@/lib/analytics";
import { api } from "@/lib/api";
import { formatPrice, PLAN_LABEL, PLAN_POINTS } from "@/lib/plans";
import { useBillingStatus, useMe, useOffers } from "@/lib/queries";
import { AppHeader } from "../AppHeader";
import { useT } from "@/lib/i18n";

const PAID: Exclude<Plan, "free">[] = ["standard", "premium", "executive"];
type Provider = "stripe" | "local";

/** Plans, yearly discount and Job-Hunt Passes, with checkout through the chosen payment method. */
export function PricingPage() {
  const t = useT();
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
  const subFor = (plan: Plan) =>
    list.find((o) => o.kind === "subscription" && o.plan === plan && o.interval === interval);
  const monthly = (plan: Plan) =>
    list.find((o) => o.kind === "subscription" && o.plan === plan && o.interval === "month");
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
    <div className="min-h-dvh bg-canvas">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-(--layout-lg) flex-col gap-12 px-4 pb-20 pt-10 sm:gap-16 sm:px-6 sm:pt-16">
        <header className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
          <div className="flex flex-col gap-3">
            <h1 className="font-display text-[32px]/[38px] font-bold tracking-tight text-balance text-ink sm:text-[38px]/[44px]">
              {t("pricing.title")}
            </h1>
            <p className="text-base text-ink-2">{t("pricing.subtitle")}</p>
          </div>

          {cancelled && <Alert className="w-full max-w-md text-start">{t("pricing.cancelled")}</Alert>}
          {checkout.error && (
            <Alert tone="danger" className="w-full max-w-md text-start">
              {checkout.error.message}
            </Alert>
          )}

          <div className="flex max-w-full flex-col items-center gap-3">
            <SegmentedControl
              label="Billing period"
              value={interval}
              onChange={setBillingInterval}
              options={[
                { value: "month", label: t("pricing.monthly") },
                { value: "year", label: t("pricing.yearly") },
              ]}
            />
            <div role="group" aria-label="Payment method" className="flex flex-wrap justify-center gap-2">
              <Chip icon="credit" selected={provider === "stripe"} onClick={() => setProvider("stripe")}>
                Card (Visa, Mastercard)
              </Chip>
              <Chip
                selected={provider === "local"}
                disabled={!localAvailable}
                onClick={() => setProvider("local")}
                title={localAvailable ? undefined : "Coming soon"}
              >
                JazzCash / Easypaisa · coming soon
              </Chip>
            </div>
          </div>
        </header>

        <div className="grid gap-6 pt-3 md:grid-cols-2 lg:grid-cols-4">
          <PlanCard plan="free" price="$0" note="forever" current={current === "free"} highlight={false}>
            <Button block disabled>
              {me.data ? t("pricing.yourPlan") : t("pricing.included")}
            </Button>
          </PlanCard>
          {PAID.map((plan) => {
            const offer = subFor(plan);
            const m = monthly(plan);
            const perMonth = offer ? (offer.interval === "year" ? offer.priceCents / 12 : offer.priceCents) : 0;
            const saving =
              offer && m && offer.interval === "year"
                ? Math.round((1 - offer.priceCents / (m.priceCents * 12)) * 100)
                : 0;
            return (
              <PlanCard
                key={plan}
                plan={plan}
                price={offer ? formatPrice(Math.round(perMonth), offer.currency) : "…"}
                note={
                  offer?.interval === "year"
                    ? `a month, ${formatPrice(offer.priceCents, offer.currency)} billed yearly${saving ? ` (save ${saving}%)` : ""}`
                    : "a month"
                }
                current={current === plan}
                highlight={highlight === plan}
              >
                <Button
                  block
                  variant={highlight === plan ? "primary" : "secondary"}
                  disabled={!offer?.available || checkout.isPending || portal.isPending || current === plan}
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

        <div className="flex flex-col gap-6">
          <OfferBand
            title={t("pricing.pass")}
            description="Everything in Premium for a set time, paid once. No subscription to remember to cancel."
          >
            {passes.map((p) => (
              <OfferTile key={p.id} name={`${p.days} days`} price={`${formatPrice(p.priceCents, p.currency)} once`}>
                <Button size="sm" disabled={!p.available || checkout.isPending} onClick={() => buy(p)}>
                  {p.available ? t("pricing.buyPass") : "Soon"}
                </Button>
              </OfferTile>
            ))}
          </OfferBand>

          {packs.length > 0 && (
            <OfferBand id="credits" title={t("pricing.credits")} description={t("pricing.creditsDesc")}>
              {packs.map((p) => (
                <OfferTile
                  key={p.id}
                  name={`${p.credits} credits`}
                  price={`${formatPrice(p.priceCents, p.currency)} once`}
                >
                  <Button size="sm" disabled={!p.available || checkout.isPending} onClick={() => buy(p)}>
                    {p.available ? "Buy" : "Soon"}
                  </Button>
                </OfferTile>
              ))}
            </OfferBand>
          )}
        </div>

        <p className="cvb-caption mx-auto max-w-2xl text-center">
          Prices in US dollars. Cancel any time; you keep your plan until the end of the period you paid for. Every
          template stays free to preview.
        </p>
      </main>
    </div>
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
          <h2 className="cvb-h3">{PLAN_LABEL[plan]}</h2>
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

function OfferBand({
  id,
  title,
  description,
  children,
}: {
  id?: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="cvb-card grid scroll-mt-20 gap-6 p-5 sm:p-6 md:grid-cols-[1.2fr_2fr] md:items-center">
      <div className="flex flex-col gap-1">
        <h2 className="cvb-h2">{title}</h2>
        <p className="text-ink-2">{description}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
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
