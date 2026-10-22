"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { sampleCV } from "@cvb/domain";
import { TEMPLATES, TIERS } from "@cvb/templates/catalog";
import { Alert, Badge, Button, Icon, Logo, MatchScore, PaperSheet, ScoreRing, SegmentedControl, TierBadge, markPlaceholders, type IconName } from "@cvb/ui";
import { useCatalog } from "@/lib/catalog";
import { useT, type MessageKey } from "@/lib/i18n";
import { formatPrice } from "@/lib/plans";
import { CURRENCY_LABEL, useCurrency, useOfferPrices, type Currency } from "@/lib/currency";
import { AppHeader } from "../AppHeader";
import { useBranding } from "../branding/BrandingProvider";
import { ScaledCV } from "../cv/ScaledCV";
import { WhatsAppHelp } from "../trust/WhatsAppHelp";
import { BeforeAfter } from "./BeforeAfter";
import { HonestPricing } from "./HonestPricing";
import { ProductDemo } from "./ProductDemo";
import { RegionalFormats } from "./RegionalFormats";
import { Reviews } from "./Reviews";
import { bodyText, Check, FeatureIcon, rtlBody, rtlHead, SectionHead, useStart, wrap } from "./shared";
import { StatsLine } from "./StatsLine";

/*
 * The home page (/). Says what the product does for a job seeker, shows it, and gets them
 * started. Every claim here is something the product does today; numbers and reviews are real
 * (and hidden until there are enough), and example content says it's an example.
 * All text comes from the i18n messages (`landing.*`), in English, Urdu and Arabic.
 */

export function LandingPage() {
  const t = useT();
  const deleted = useSearchParams().get("deleted") === "1";
  return (
    <div className="min-h-dvh bg-canvas">
      <AppHeader />
      <main>
        {deleted && (
          <div className={`${wrap} pt-6`}>
            <Alert tone="success">{t("landing.deleted")}</Alert>
          </div>
        )}
        <Hero />
        <Facts />
        <ProductDemo />
        <HowItWorks />
        <BeforeAfter />
        <AiFeatures />
        <Templates />
        <RegionalFormats />
        <Toolkit />
        <Experts />
        <Reviews />
        <HonestPricing />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <WhatsAppHelp />
    </div>
  );
}

/* ------------------------------------------------------------------ Hero */

function Hero() {
  const t = useT();
  const start = useStart();
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden border-b border-line">
      {/* Dotted paper texture, fading out towards the text. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(var(--canvas-dot)_1px,transparent_1.2px)] [background-size:18px_18px] [mask-image:linear-gradient(to_left,black,transparent_75%)] rtl:[mask-image:linear-gradient(to_right,black,transparent_75%)]" />
      <div className={`${wrap} relative grid items-center gap-12 pb-16 pt-12 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-20`}>
        <div className="flex flex-col gap-7">
          <Badge tone="highlight" pill icon="sparkle" className="self-start">
            {t("landing.hero.badge")}
          </Badge>
          <div className="flex flex-col gap-5">
            <h1 id="hero-title" className={`font-display text-[40px] font-[760] leading-[46px] tracking-[-0.03em] text-balance text-ink sm:text-[56px] sm:leading-[60px] ${rtlHead}`}>
              {t("landing.hero.title")} <span className="text-brand-ink">{t("landing.hero.titleAccent")}</span>
            </h1>
            <p className={`max-w-[36rem] text-lg leading-[28px] text-pretty text-ink-2 ${rtlBody}`}>{t("landing.hero.lead")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" size="lg" iconEnd="arrow-right" href={start.primary.href}>
              {start.primary.label}
            </Button>
            <Button size="lg" icon="sparkle" href={start.ai}>
              {t("landing.hero.ai")}
            </Button>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-2">
            {(["landing.hero.tick1", "landing.hero.tick2", "landing.hero.tick3"] as const).map((k) => (
              <li key={k} className="flex items-center gap-1.5">
                <Icon name="check-circle" size={16} className="text-success" />
                {t(k)}
              </li>
            ))}
          </ul>
          <StatsLine />
          <p className={`text-sm text-ink-3 ${rtlBody}`}>
            {t("landing.hero.haveCv")}{" "}
            <Link href={start.importHref} className="font-semibold text-brand-ink underline-offset-4 hover:underline">
              {t("landing.hero.importLink")}
            </Link>{" "}
            {t("landing.hero.importAfter")}
          </p>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}

/** A CV with the checks and AI help floating around it: what the product looks like in use. */
function HeroVisual() {
  const t = useT();
  return (
    <div aria-hidden="true" inert className="relative mx-auto w-full max-w-[520px] select-none pb-6 pt-4 sm:px-8">
      <PaperSheet maxWidth={420} className="relative mx-auto rotate-[-1.2deg] shadow-[var(--shadow-lg)] rtl:rotate-[1.2deg]">
        <ScaledCV cv={sampleCV} template="modern" />
      </PaperSheet>

      <div className="absolute -start-1 top-[10%] flex items-center gap-3 rounded-lg border border-line bg-surface p-3 pe-4 shadow-[var(--shadow-md)] sm:start-0">
        <ScoreRing value={92} size="sm" tone="success" />
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-ink">{t("landing.hero.atsCheck")}</span>
          <span className="cvb-caption">{t("landing.hero.ready")}</span>
        </div>
      </div>

      <div className="absolute -end-1 top-[42%] hidden w-[230px] flex-col gap-2 rounded-lg border border-line bg-surface p-3 shadow-[var(--shadow-md)] sm:flex sm:end-0">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-brand-ink">
          <Icon name="sparkle" size={14} /> {t("landing.hero.aiSuggestion")}
        </span>
        <span className={`text-xs leading-5 text-ink-3 line-through ${rtlBody}`}>{t("landing.hero.weakLine")}</span>
        <span className={`text-xs leading-5 text-ink ${rtlBody}`}>{markPlaceholders(t("landing.hero.strongLine"))}</span>
      </div>

      <div className="absolute bottom-0 start-[8%] flex items-center gap-3 rounded-lg border border-line bg-surface px-3.5 py-2.5 shadow-[var(--shadow-md)]">
        <Icon name="target" size={18} className="text-brand-ink" />
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-ink">{t("landing.hero.matchJob")}</span>
          <MatchScore score={86} label={t("landing.hero.match", { n: 86 })} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Facts strip */

function Facts() {
  const t = useT();
  const facts: { icon: IconName; value: string; label: string }[] = [
    { icon: "template", value: `${TEMPLATES.length}`, label: t("landing.facts.templates") },
    { icon: "check-circle", value: "ATS", label: t("landing.facts.ats") },
    { icon: "download", value: t("landing.facts.exportsValue"), label: t("landing.facts.exports") },
    { icon: "languages", value: "3", label: t("landing.facts.languages") },
  ];
  return (
    <section aria-label={t("landing.facts.label")} className="border-b border-line bg-surface">
      <ul className={`${wrap} grid grid-cols-2 gap-6 py-8 lg:grid-cols-4`}>
        {facts.map((f) => (
          <li key={f.label} className="flex items-center gap-3">
            <FeatureIcon name={f.icon} />
            <div className="flex min-w-0 flex-col">
              <span className="font-display text-xl font-[720] leading-7 text-ink">{f.value}</span>
              <span className={`text-sm leading-5 text-ink-2 ${rtlBody}`}>{f.label}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ How it works */

function HowItWorks() {
  const t = useT();
  const steps: { icon: IconName; title: MessageKey; text: MessageKey }[] = [
    { icon: "upload", title: "landing.how.s1", text: "landing.how.s1d" },
    { icon: "edit", title: "landing.how.s2", text: "landing.how.s2d" },
    { icon: "download", title: "landing.how.s3", text: "landing.how.s3d" },
  ];
  return (
    <section aria-labelledby="how-title" className="py-20">
      <div className={`${wrap} flex flex-col gap-12`}>
        <SectionHead id="how-title" eyebrow={t("landing.how.eyebrow")} title={t("landing.how.title")} center />
        <ol className="grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="relative flex flex-col gap-4 rounded-xl border border-line bg-surface p-6">
              <div className="flex items-center justify-between">
                <FeatureIcon name={s.icon} />
                <span className="font-display text-4xl font-[760] text-surface-3" aria-hidden="true">
                  {i + 1}
                </span>
              </div>
              <h3 className="cvb-h3">{t(s.title)}</h3>
              <p className={bodyText}>{t(s.text)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ AI */

function AiFeatures() {
  const t = useT();
  const start = useStart();
  const features: { icon: IconName; title: MessageKey; text: MessageKey; href: string; cta: MessageKey }[] = [
    { icon: "upload", title: "landing.ai.f1", text: "landing.ai.f1d", href: start.importHref, cta: "landing.ai.f1cta" },
    { icon: "target", title: "landing.ai.f2", text: "landing.ai.f2d", href: start.signedIn ? "/app" : "/builder", cta: "landing.ai.f2cta" },
    { icon: "sparkle", title: "landing.ai.f3", text: "landing.ai.f3d", href: start.ai, cta: "landing.ai.f3cta" },
  ];
  return (
    <section aria-labelledby="ai-title" className="border-y border-line bg-surface py-20">
      <div className={`${wrap} grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start`}>
        <div className="flex flex-col gap-6 lg:sticky lg:top-24">
          <SectionHead id="ai-title" eyebrow={t("landing.ai.eyebrow")} title={t("landing.ai.title")} lead={t("landing.ai.lead")} />
          <ul className="flex flex-col gap-2">
            <Check>{t("landing.ai.check1")}</Check>
            <Check>{t("landing.ai.check2")}</Check>
            <Check>{markPlaceholders(t("landing.ai.check3"))}</Check>
          </ul>
        </div>
        <ul className="flex flex-col gap-4">
          {features.map((f) => (
            <li key={f.title} className="group relative flex gap-4 rounded-xl border border-line bg-canvas p-5 transition hover:border-line-strong hover:shadow-[var(--shadow-sm)] sm:p-6">
              <FeatureIcon name={f.icon} />
              <div className="flex min-w-0 flex-col gap-2">
                <h3 className="cvb-h3">{t(f.title)}</h3>
                <p className={bodyText}>{t(f.text)}</p>
                <Link href={f.href} className="mt-1 inline-flex items-center gap-1 self-start text-sm font-semibold text-brand-ink outline-none after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:after:shadow-[var(--focus-ring)]">
                  {t(f.cta)}
                  <Icon name="arrow-right" size={16} className="transition group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Templates */

function Templates() {
  const t = useT();
  const { templates } = useCatalog();
  const showcase = TIERS.map((tier) => templates.find((x) => x.tier === tier.id)).filter((x) => x !== undefined);
  return (
    <section aria-labelledby="templates-title" className="py-20">
      <div className={`${wrap} flex flex-col gap-10`}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHead id="templates-title" eyebrow={t("landing.templates.eyebrow")} title={t("landing.templates.title")} lead={t("landing.templates.lead")} />
          <Button href="/templates" iconEnd="arrow-right">
            {t("landing.templates.all", { count: TEMPLATES.length })}
          </Button>
        </div>
        <ul className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {showcase.map((m) => (
            <li key={m.id} className="min-w-0">
              <article className="cvb-template relative h-full has-[a:focus-visible]:shadow-[var(--focus-ring)]">
                <div className="cvb-template-thumb" aria-hidden="true" inert>
                  <PaperSheet accent={m.accent}>
                    <ScaledCV cv={sampleCV} template={m.id} />
                  </PaperSheet>
                </div>
                <div className="cvb-template-meta gap-2">
                  <div className="cvb-template-row">
                    <span className="size-2.5 shrink-0 rounded-full ring-1 ring-line-strong" style={{ background: m.accent }} />
                    <h3 className="cvb-h3 min-w-0 flex-1 truncate">
                      <Link href="/templates" className="text-ink outline-none after:absolute after:inset-0 after:content-['']">
                        {m.name}
                      </Link>
                    </h3>
                  </div>
                  <div className="cvb-template-row">
                    <TierBadge tier={m.tier} />
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Toolkit */

function Toolkit() {
  const t = useT();
  const tools: { icon: IconName; title: MessageKey; text: MessageKey; href: string }[] = [
    { icon: "briefcase", title: "landing.toolkit.jobs", text: "landing.toolkit.jobsd", href: "/jobs" },
    { icon: "kanban", title: "landing.toolkit.tracker", text: "landing.toolkit.trackerd", href: "/tracker" },
    { icon: "mic", title: "landing.toolkit.interview", text: "landing.toolkit.interviewd", href: "/interview" },
    { icon: "mail", title: "landing.toolkit.letters", text: "landing.toolkit.lettersd", href: "/letters" },
    { icon: "share", title: "landing.toolkit.share", text: "landing.toolkit.shared", href: "/pricing" },
    { icon: "globe", title: "landing.toolkit.website", text: "landing.toolkit.websited", href: "/website" },
  ];
  const start = useStart();
  return (
    <section aria-labelledby="toolkit-title" className="border-y border-line bg-surface py-20">
      <div className={`${wrap} flex flex-col gap-12`}>
        <SectionHead id="toolkit-title" eyebrow={t("landing.toolkit.eyebrow")} title={t("landing.toolkit.title")} lead={t("landing.toolkit.lead")} center />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => {
            const href = start.signedIn || tool.href === "/pricing" ? tool.href : `/sign-up?next=${encodeURIComponent(tool.href)}`;
            return (
              <li key={tool.title} className="group relative flex flex-col gap-3 rounded-xl border border-line bg-canvas p-6 transition hover:border-line-strong hover:shadow-[var(--shadow-sm)]">
                <FeatureIcon name={tool.icon} />
                <h3 className="cvb-h3">
                  <Link href={href} className="text-ink outline-none after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:after:shadow-[var(--focus-ring)]">
                    {t(tool.title)}
                  </Link>
                </h3>
                <p className={bodyText}>{t(tool.text)}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Experts */

function Experts() {
  const t = useT();
  const points: { icon: IconName; title: MessageKey; text: MessageKey }[] = [
    { icon: "message", title: "landing.experts.p1", text: "landing.experts.p1d" },
    { icon: "clock", title: "landing.experts.p2", text: "landing.experts.p2d" },
    { icon: "award", title: "landing.experts.p3", text: "landing.experts.p3d" },
  ];
  return (
    <section aria-labelledby="experts-title" className="py-20">
      <div className={wrap}>
        <div className="grid items-center gap-10 overflow-hidden rounded-2xl border border-line bg-surface p-8 sm:p-12 lg:grid-cols-[1.2fr_1fr]">
          <div className="flex flex-col gap-6">
            <SectionHead id="experts-title" eyebrow={t("landing.experts.eyebrow")} title={t("landing.experts.title")} lead={t("landing.experts.lead")} />
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" href="/experts" iconEnd="arrow-right">
                {t("landing.experts.find")}
              </Button>
              <Button variant="ghost" href="/pricing">
                {t("landing.experts.included")}
              </Button>
            </div>
          </div>
          <ul className="flex flex-col gap-3">
            {points.map((x) => (
              <li key={x.title} className="flex items-start gap-3 rounded-lg bg-canvas p-4">
                <FeatureIcon name={x.icon} tone="gold" />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-ink">{t(x.title)}</span>
                  <span className={`text-sm text-ink-2 ${rtlBody}`}>{t(x.text)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Pricing teaser */

const PLAN_KEYS = ["free", "standard", "premium", "executive"] as const;
type PlanKey = (typeof PLAN_KEYS)[number];
const POINT_KEYS: Record<PlanKey, MessageKey[]> = {
  free: ["landing.pricing.free1", "landing.pricing.free2", "landing.pricing.free3", "landing.pricing.free4"],
  standard: ["landing.pricing.standard1", "landing.pricing.standard2", "landing.pricing.standard3", "landing.pricing.standard4"],
  premium: ["landing.pricing.premium1", "landing.pricing.premium2", "landing.pricing.premium3", "landing.pricing.premium4"],
  executive: ["landing.pricing.executive1", "landing.pricing.executive2", "landing.pricing.executive3"],
};

function Pricing() {
  const t = useT();
  const [currency, setCurrency] = useCurrency();
  const offers = useOfferPrices(currency);
  const monthly = (plan: string) => offers.data?.find((o) => o.kind === "subscription" && o.plan === plan && o.interval === "month");
  const plans = PLAN_KEYS.map((plan) => {
    const offer = plan === "free" ? null : monthly(plan);
    return {
      plan,
      price: plan === "free" ? formatPrice(0, currency) : offer ? formatPrice(offer.priceCents, offer.currency) : null,
      note: plan === "free" ? t("landing.pricing.forever") : t("landing.pricing.perMonth"),
      points: POINT_KEYS[plan].map((k) => t(k)),
    };
  });
  return (
    <section aria-labelledby="pricing-title" className="border-y border-line bg-surface py-20">
      <div className={`${wrap} flex flex-col gap-12`}>
        <SectionHead id="pricing-title" eyebrow={t("landing.pricing.eyebrow")} title={t("landing.pricing.title")} lead={t("landing.pricing.lead")} center />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => (
            <li key={p.plan} className={`relative flex flex-col gap-5 rounded-xl border bg-canvas p-6 ${p.plan === "premium" ? "border-brand shadow-[0_0_0_1px_var(--brand)]" : "border-line"}`}>
              {p.plan === "premium" && (
                <Badge tone="brand" variant="solid" pill className="absolute -top-3 start-6">
                  {t("landing.pricing.recommended")}
                </Badge>
              )}
              <div className="flex flex-col gap-1">
                <h3 className="cvb-h3">{t(`landing.plan.${p.plan}`)}</h3>
                <p className="flex items-baseline gap-1.5">
                  <bdi className="font-display text-3xl font-[760] text-ink">{p.price ?? "·"}</bdi>
                  {p.price && <span className="text-sm text-ink-3">{p.note}</span>}
                </p>
              </div>
              <ul className="flex flex-col gap-2">
                {p.points.map((x) => (
                  <Check key={x}>{x}</Check>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <SegmentedControl<Currency>
            label={t("landing.pricing.currency")}
            size="sm"
            value={currency}
            onChange={setCurrency}
            options={(["pkr", "usd"] as const).map((c) => ({ value: c, label: CURRENCY_LABEL[c] }))}
          />
          <Button href="/pricing" iconEnd="arrow-right">
            {t("landing.pricing.compare")}
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ FAQ */

const FAQ: { q: MessageKey; a: MessageKey }[] = [
  { q: "landing.faq.q1", a: "landing.faq.a1" },
  { q: "landing.faq.q2", a: "landing.faq.a2" },
  { q: "landing.faq.q3", a: "landing.faq.a3" },
  { q: "landing.faq.q4", a: "landing.faq.a4" },
  { q: "landing.faq.q5", a: "landing.faq.a5" },
  { q: "landing.faq.q6", a: "landing.faq.a6" },
  { q: "landing.faq.q7", a: "landing.faq.a7" },
];

function Faq() {
  const t = useT();
  return (
    <section aria-labelledby="faq-title" className="py-20">
      <div className={`${wrap} grid gap-10 lg:grid-cols-[0.8fr_1.2fr]`}>
        <div className="flex flex-col gap-6">
          <SectionHead id="faq-title" eyebrow={t("landing.faq.eyebrow")} title={t("landing.faq.title")} lead={t("landing.faq.lead")} />
          <TalkToExpert />
        </div>
        <div className="flex flex-col gap-3">
          {FAQ.map((f) => (
            <details key={f.q} className="cvb-card group [&_summary::-webkit-details-marker]:hidden">
              <summary className={`flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-lg px-5 py-4 text-start font-semibold text-ink focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none ${rtlBody}`}>
                <span className="flex-1">{t(f.q)}</span>
                <Icon name="plus" size={18} className="shrink-0 text-ink-3 transition group-open:rotate-45" />
              </summary>
              <p className={`px-5 pb-5 ${bodyText}`}>{t(f.a)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/** The way to a person: book an expert. (The WhatsApp button covers quick questions.) */
function TalkToExpert() {
  const t = useT();
  return (
    <div className="flex items-start gap-4 rounded-xl border border-line bg-surface p-5">
      <FeatureIcon name="users" tone="gold" />
      <div className="flex min-w-0 flex-col gap-2">
        <h3 className="cvb-h3">{t("landing.expert.title")}</h3>
        <p className={bodyText}>{t("landing.expert.text")}</p>
        <Link href="/experts" className="inline-flex items-center gap-1 self-start text-sm font-semibold text-brand-ink underline-offset-4 hover:underline">
          {t("landing.expert.cta")}
          <Icon name="arrow-right" size={16} className="rtl:rotate-180" />
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Final call to action */

function FinalCta() {
  const t = useT();
  const start = useStart();
  return (
    <section aria-labelledby="cta-title" className="pb-20">
      <div className={wrap}>
        <div className="relative overflow-hidden rounded-2xl bg-appbar-bg px-6 py-14 text-center sm:px-12">
          <div aria-hidden="true" className="pointer-events-none absolute -end-24 -top-24 size-72 rounded-full bg-gold opacity-20 blur-3xl" />
          <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6">
            <h2 id="cta-title" className={`font-display text-[30px] font-[740] leading-[36px] tracking-[-0.02em] text-balance text-appbar-ink sm:text-[40px] sm:leading-[46px] ${rtlHead}`}>
              {t("landing.cta.title")}
            </h2>
            <p className={`text-base leading-[26px] text-appbar-ink-2 ${rtlBody}`}>{t("landing.cta.lead")}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="highlight" size="lg" iconEnd="arrow-right" href={start.primary.href}>
                {start.primary.label}
              </Button>
              <Link
                href="/templates"
                className="inline-flex min-h-12 items-center rounded-md px-5 text-base font-semibold text-appbar-ink underline-offset-4 hover:bg-appbar-hover focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
              >
                {t("landing.cta.templates")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Footer */

function Footer() {
  const t = useT();
  const branding = useBranding();
  const product = branding?.productName || "CV Builder";
  const cols: { title: string; links: { href: string; label: string }[] }[] = [
    {
      title: t("landing.footer.build"),
      links: [
        { href: "/builder", label: t("landing.footer.builder") },
        { href: "/new", label: t("landing.footer.ai") },
        { href: "/templates", label: t("landing.footer.templates") },
        { href: "/cv-examples", label: t("landing.footer.examples") },
      ],
    },
    {
      title: t("landing.footer.freeTools"),
      links: [
        { href: "/ats-checker", label: t("landing.footer.atsChecker") },
        { href: "/tools/summary-generator", label: t("landing.footer.summaryGenerator") },
        { href: "/tools/bullet-improver", label: t("landing.footer.bulletImprover") },
        { href: "/tools", label: t("landing.footer.allTools") },
      ],
    },
    {
      title: t("landing.footer.jobHunt"),
      links: [
        { href: "/jobs", label: t("landing.footer.jobs") },
        { href: "/tracker", label: t("landing.footer.tracker") },
        { href: "/interview", label: t("landing.footer.interview") },
        { href: "/letters", label: t("landing.footer.letters") },
      ],
    },
    {
      title: t("landing.footer.services"),
      links: [
        { href: "/experts", label: t("landing.footer.experts") },
        { href: "/pricing", label: t("landing.footer.pricing") },
        { href: "/sign-in", label: t("landing.footer.signIn") },
      ],
    },
  ];
  return (
    <footer className="border-t border-line bg-surface">
      <div className={`${wrap} grid gap-10 py-12 sm:grid-cols-2 md:grid-cols-[1.4fr_repeat(4,1fr)]`}>
        <div className="flex flex-col gap-3">
          <Logo href="/" product={product} logoSrc={branding?.logoUrl || null} />
          <p className={`max-w-xs text-sm leading-6 text-ink-3 ${rtlBody}`}>{t("landing.footer.tagline")}</p>
        </div>
        {cols.map((c) => (
          <nav key={c.title} aria-label={c.title} className="flex flex-col gap-3">
            <span className="cvb-overline text-ink-3">{c.title}</span>
            <ul className="flex flex-col gap-2">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-ink-2 hover:text-brand-ink hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <p className={`${wrap} py-5 text-xs text-ink-3`}>
          © {new Date().getFullYear()} {product}
        </p>
      </div>
    </footer>
  );
}
