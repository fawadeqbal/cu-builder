"use client";

import { afterExampleCV, atsReport, beforeExampleCV, clean, type CV } from "@cvb/domain";
import { Badge, Button, Icon, ScoreRing, markPlaceholders } from "@cvb/ui";
import { useI18n, useT, type MessageKey } from "@/lib/i18n";
import { bodyText, rtlBody, SectionHead, useStart, wrap } from "./shared";

/** Scores from the real ATS check (the same code the editor runs), on an ATS-friendly template. */
const BEFORE = atsReport(beforeExampleCV, { templateAts: true, pages: 1 });
const AFTER = atsReport(afterExampleCV, { templateAts: true, pages: 1 });

const CHANGES: MessageKey[] = ["landing.ba.change1", "landing.ba.change2", "landing.ba.change3", "landing.ba.change4"];

/** A weak CV excerpt next to the improved one, each with its real ATS score. Example content, labelled so. */
export function BeforeAfter() {
  const t = useT();
  const start = useStart();
  return (
    <section aria-labelledby="ba-title" className="border-y border-line bg-surface py-20">
      <div className={`${wrap} flex flex-col gap-10`}>
        <SectionHead
          id="ba-title"
          eyebrow={t("landing.ba.eyebrow")}
          title={t("landing.ba.title")}
          lead={t("landing.ba.lead")}
          center
        />
        <div className="grid gap-5 lg:grid-cols-2">
          <Excerpt cv={beforeExampleCV} score={BEFORE.score} label={t("landing.ba.before")} tone="before" />
          <Excerpt cv={afterExampleCV} score={AFTER.score} label={t("landing.ba.after")} tone="after" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-start">
          <div className="flex flex-col gap-3">
            <h3 className="cvb-h3">{t("landing.ba.changed")}</h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {CHANGES.map((k) => (
                <li key={k} className={`flex items-start gap-2.5 ${bodyText}`}>
                  <Icon name="check" size={16} className="mt-1 shrink-0 text-success" />
                  <span>{t(k)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-4 rounded-xl border border-line bg-canvas p-5">
            <p className={`flex items-start gap-2.5 ${bodyText}`}>
              <Icon name="info" size={16} className="mt-1 shrink-0 text-ink-3" />
              <span>{markPlaceholders(t("landing.ba.note"))}</span>
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" href={start.primary.href} iconEnd="arrow-right">
                {t("landing.ba.cta")}
              </Button>
              <Button variant="ghost" href="/experts">
                {t("landing.expert.cta")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Excerpt({ cv, score, label, tone }: { cv: CV; score: number; label: string; tone: "before" | "after" }) {
  const t = useT();
  const job = cv.experience[0];
  return (
    <article
      aria-label={`${label}: ${t("landing.ba.scoreLabel", { n: score })}`}
      className={`flex min-w-0 flex-col gap-4 rounded-xl border bg-canvas p-5 sm:p-6 ${tone === "after" ? "border-success" : "border-line"}`}
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="cvb-h3">{label}</h3>
          <Badge tone="neutral" icon="info">
            {t("landing.ba.example")}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="cvb-caption">{t("landing.ba.atsScore")}</span>
          <ScoreRing value={score} size="md" label={t("landing.ba.scoreLabel", { n: score })} />
        </div>
      </header>
      {/* CV content is English example text: keep it left-to-right in every interface language. */}
      <div
        lang="en"
        dir="ltr"
        className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 text-start text-[13px] leading-5 text-ink"
      >
        <div className="flex flex-col">
          <span className="font-display text-base font-[700]">{cv.personal.name}</span>
          {cv.personal.headline ? (
            <span className="text-ink-2">{cv.personal.headline}</span>
          ) : (
            <Missing>{t("landing.ba.noHeadline")}</Missing>
          )}
          <span className="text-xs text-ink-3">
            {[cv.personal.email, cv.personal.phone, cv.personal.location, cv.personal.linkedin]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
        <p className="text-ink-2">{cv.summary}</p>
        {job && (
          <div className="flex flex-col gap-1">
            <span className="font-semibold">
              {job.role}, {job.company} <span className="font-normal text-ink-3">· {job.date}</span>
            </span>
            <ul className="flex list-disc flex-col gap-1 ps-5">
              {clean(job.bullets).map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-col gap-0.5">
          {cv.skills.map((s) => (
            <span key={s.id}>
              <span className="font-semibold">{s.category}:</span> {s.items}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

/** A note in the interface language inside the English excerpt. */
function Missing({ children }: { children: string }) {
  const { locale, dir } = useI18n();
  return (
    <span
      lang={locale}
      dir={dir}
      className={`inline-flex items-center gap-1 self-start rounded bg-warning-soft px-1.5 text-xs text-ink ${rtlBody}`}
    >
      <Icon name="alert-triangle" size={12} /> {children}
    </span>
  );
}
