"use client";

import Link from "next/link";
import { TEMPLATES, TIERS } from "@cvb/templates/catalog";
import { sampleCV } from "@cvb/domain";
import { Button, Icon, PaperSheet, PreviewCanvas, TierBadge } from "@cvb/ui";
import { useCatalog } from "@/lib/catalog";
import { useT } from "@/lib/i18n";
import { AppHeader } from "./AppHeader";
import { ScaledCV } from "./cv/ScaledCV";
import { WhatsAppHelp } from "./trust/WhatsAppHelp";

type Props = {
  onStart: () => void;
  onExample: () => void;
  onImport: () => void;
  signedIn: boolean;
};

const POINTS = [
  { title: "welcome.f1", text: "welcome.f1d", icon: "edit" },
  { title: "welcome.f2", text: "welcome.f2d", icon: "eye" },
  { title: "welcome.f3", text: "welcome.f3d", icon: "download" },
] as const;

/** The builder's start screen (/builder): start fresh, open the example or import, and a look at the templates. */
export function Welcome({ onStart, onExample, onImport, signedIn }: Props) {
  const t = useT();
  const { templates } = useCatalog();
  const showcase = TIERS.map((tier) => templates.find((x) => x.tier === tier.id)).filter((x) => x !== undefined);
  const linkClass =
    "self-start text-start text-sm font-medium text-ink-2 underline-offset-4 hover:text-brand-ink hover:underline";

  return (
    <div className="min-h-dvh bg-canvas">
      <AppHeader />

      <main>
        <section className="mx-auto grid max-w-(--layout-lg) items-center gap-12 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-4">
              <h1 className="font-display text-[38px] font-[750] leading-[44px] tracking-[-0.025em] text-balance text-ink sm:text-[52px] sm:leading-[56px] [&:lang(ar)]:tracking-normal [&:lang(ur)]:leading-[1.9] [&:lang(ur)]:tracking-normal">
                {t("welcome.title")}
              </h1>
              <p className="max-w-[34rem] text-base leading-[26px] text-ink-2 [&:lang(ur)]:leading-[2.1]">
                {t("welcome.lead")}
              </p>
            </div>

            <ol className="cvb-steps max-w-md">
              {POINTS.map((p) => (
                <li key={p.title}>
                  <div className="cvb-step cursor-default hover:bg-transparent" data-status="todo">
                    <span className="cvb-step-bullet text-brand-ink">
                      <Icon name={p.icon} size={16} />
                    </span>
                    <span className="cvb-step-text">
                      <span className="cvb-step-label [&:lang(ur)]:leading-[2]">{t(p.title)}</span>
                      <span className="cvb-step-meta text-ink-2 [&:lang(ur)]:leading-[2]">{t(p.text)}</span>
                    </span>
                  </div>
                </li>
              ))}
            </ol>

            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" size="lg" icon="plus" onClick={onStart}>
                  {t("welcome.create")}
                </Button>
                <Button size="lg" icon="file" onClick={onExample}>
                  {t("welcome.example")}
                </Button>
              </div>
              <div className="flex flex-col gap-3">
                <button type="button" onClick={onImport} className={linkClass}>
                  {t("welcome.importJson")}
                </button>
                <Link href={signedIn ? "/app?import=1" : "/sign-up?next=%2Fapp%3Fimport%3D1"} className={linkClass}>
                  {t("welcome.upload")}
                </Link>
              </div>
            </div>
          </div>

          <div aria-hidden="true" inert className="hidden lg:block">
            <PreviewCanvas className="p-10">
              <PaperSheet maxWidth={420} className="rotate-[-1.5deg] rtl:rotate-[1.5deg]">
                <ScaledCV cv={sampleCV} template="classic" />
              </PaperSheet>
            </PreviewCanvas>
          </div>
        </section>

        <section className="border-t border-line bg-surface" aria-labelledby="welcome-templates">
          <div className="mx-auto flex max-w-(--layout-lg) flex-col gap-6 px-4 py-16 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="welcome-templates" className="cvb-h2">
                {t("nav.templates")}
              </h2>
              <Link
                href="/templates"
                className="text-sm font-semibold text-brand-ink underline-offset-4 hover:underline"
              >
                {t("welcome.browse", { count: TEMPLATES.length })}
              </Link>
            </div>
            <ul className="grid grid-cols-2 gap-4 sm:gap-6 xl:grid-cols-4">
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
                        <span
                          className="size-2.5 shrink-0 rounded-full ring-1 ring-line-strong"
                          style={{ background: m.accent }}
                        />
                        <h3 className="cvb-h3 min-w-0 flex-1 truncate">
                          <Link
                            href="/templates"
                            className="text-ink outline-none after:absolute after:inset-0 after:content-['']"
                          >
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
      </main>
      <WhatsAppHelp />
    </div>
  );
}
