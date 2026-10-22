"use client";

import { Icon, LogoMark, markPlaceholders } from "@cvb/ui";
import { useT, type MessageKey } from "@/lib/i18n";
import { useBranding } from "../branding/BrandingProvider";
import { rtlBody, SectionHead, wrap } from "./shared";

/*
 * Plain promises about money, each one true of this product today:
 * - PDF download is on the free plan (with a small credit line).
 * - Checkout has no trial periods; subscriptions start at their listed price.
 * - Passes are one-off payments (Stripe "payment" mode), so they can't renew.
 * - Subscriptions are cancelled online from Plan and billing; the plan runs to the end of the period.
 * - AI output goes through the no-invention guard (placeholders instead of guessed numbers).
 * The other column describes common practice without naming anyone.
 */
const ROWS: { topic: MessageKey; us: MessageKey; them: MessageKey }[] = [
  { topic: "landing.honest.download", us: "landing.honest.downloadUs", them: "landing.honest.downloadThem" },
  { topic: "landing.honest.trial", us: "landing.honest.trialUs", them: "landing.honest.trialThem" },
  { topic: "landing.honest.pass", us: "landing.honest.passUs", them: "landing.honest.passThem" },
  { topic: "landing.honest.cancel", us: "landing.honest.cancelUs", them: "landing.honest.cancelThem" },
  { topic: "landing.honest.ai", us: "landing.honest.aiUs", them: "landing.honest.aiThem" },
];

/** "CV Builder" next to "Many CV builders": what you pay for, and what you don't get surprised by. */
export function HonestPricing() {
  const t = useT();
  const branding = useBranding();
  const product = branding?.productName || "CV Builder";
  return (
    <section aria-labelledby="honest-title" className="py-20">
      <div className={`${wrap} flex flex-col gap-10`}>
        <SectionHead
          id="honest-title"
          eyebrow={t("landing.honest.eyebrow")}
          title={t("landing.honest.title")}
          lead={t("landing.honest.lead")}
          center
        />
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          {/* Column heads (wide screens); on phones each row carries its own labels. */}
          <div
            className="hidden grid-cols-[0.8fr_1.1fr_1.1fr] border-b border-line bg-surface-2 md:grid"
            aria-hidden="true"
          >
            <span className="px-5 py-3" />
            <span className="flex items-center gap-2 px-5 py-3 text-sm font-semibold text-ink">
              <LogoMark size={20} src={branding?.logoUrl || null} /> {product}
            </span>
            <span className="px-5 py-3 text-sm font-semibold text-ink-2">{t("landing.honest.others")}</span>
          </div>
          <dl className="divide-y divide-line">
            {ROWS.map((r) => (
              <div key={r.topic} className="grid gap-3 px-5 py-4 md:grid-cols-[0.8fr_1.1fr_1.1fr] md:gap-0 md:p-0">
                <dt className={`text-sm font-semibold text-ink md:px-5 md:py-4 ${rtlBody}`}>{t(r.topic)}</dt>
                <dd className="flex items-start gap-2.5 md:bg-brand-soft/40 md:px-5 md:py-4">
                  <Icon name="check-circle" size={18} className="mt-0.5 shrink-0 text-success" />
                  <span className={`text-sm leading-6 text-ink ${rtlBody}`}>
                    <span className="font-semibold md:sr-only">{product}: </span>
                    {markPlaceholders(t(r.us))}
                  </span>
                </dd>
                <dd className="flex items-start gap-2.5 md:px-5 md:py-4">
                  <Icon name="x-circle" size={18} className="mt-0.5 shrink-0 text-ink-3" />
                  <span className={`text-sm leading-6 text-ink-2 ${rtlBody}`}>
                    <span className="font-semibold md:sr-only">{t("landing.honest.others")}: </span>
                    {t(r.them)}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
