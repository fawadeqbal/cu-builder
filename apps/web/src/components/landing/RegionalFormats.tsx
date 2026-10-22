"use client";

import { regionRules, type DetailKey, type Region, type RegionRules } from "@cvb/domain";
import { Badge, Icon } from "@cvb/ui";
import Link from "next/link";
import { useT, type MessageKey } from "@/lib/i18n";
import { bodyText, rtlBody, SectionHead, useStart, wrap } from "./shared";

type Card = { id: string; regions: Region[]; title: MessageKey; text: MessageKey; extra?: MessageKey };

/** The conventions come from the domain's `regionRules`, the same rules the editor's region presets apply. */
const CARDS: Card[] = [
  { id: "south-asia", regions: ["south_asia"], title: "landing.regions.southAsia", text: "landing.regions.southAsiad" },
  { id: "gulf", regions: ["gulf"], title: "landing.regions.gulf", text: "landing.regions.gulfd" },
  { id: "europass", regions: ["europass"], title: "landing.regions.europass", text: "landing.regions.europassd" },
  {
    id: "us-uk",
    regions: ["us", "uk"],
    title: "landing.regions.usUk",
    text: "landing.regions.usUkd",
    extra: "landing.regions.ukNote",
  },
];

const PHOTO_KEY: Record<RegionRules["photo"], MessageKey> = {
  expected: "landing.regions.photoExpected",
  optional: "landing.regions.photoOptional",
  no: "landing.regions.photoNo",
};

const DETAIL_KEY: Record<DetailKey, MessageKey> = {
  dateOfBirth: "landing.detail.dateOfBirth",
  nationality: "landing.detail.nationality",
  gender: "landing.detail.gender",
  maritalStatus: "landing.detail.maritalStatus",
  visaStatus: "landing.detail.visaStatus",
  drivingLicence: "landing.detail.drivingLicence",
  fatherName: "landing.detail.fatherName",
  idNumber: "landing.detail.idNumber",
  religion: "landing.detail.religion",
};

/** What employers expect in each region, with a small sketch of a CV laid out that way. */
export function RegionalFormats() {
  const t = useT();
  const start = useStart();
  return (
    <section aria-labelledby="regions-title" className="border-y border-line bg-surface py-20">
      <div className={`${wrap} flex flex-col gap-10`}>
        <SectionHead
          id="regions-title"
          eyebrow={t("landing.regions.eyebrow")}
          title={t("landing.regions.title")}
          lead={t("landing.regions.lead")}
          center
        />
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {CARDS.map((card) => {
            const rules = regionRules(card.regions[0]!);
            return (
              <li key={card.id} className="flex min-w-0 flex-col gap-4 rounded-xl border border-line bg-canvas p-5">
                <MiniCv rules={rules} />
                <div className="flex flex-col gap-2">
                  <h3 className="cvb-h3">{t(card.title)}</h3>
                  <p className={bodyText}>{t(card.text)}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone={rules.photo === "no" ? "neutral" : "brand"} icon="user">
                    {t(PHOTO_KEY[rules.photo])}
                  </Badge>
                  <Badge tone="neutral" icon="file">
                    {card.regions
                      .map((r) => (regionRules(r).pageSize === "LETTER" ? t("landing.regions.letter") : "A4"))
                      .join(" / ")}
                  </Badge>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="cvb-overline text-ink-3">{t("landing.regions.details")}</span>
                  {rules.details.length ? (
                    <ul className="flex flex-wrap gap-1.5">
                      {rules.details.map((d) => (
                        <li key={d} className={`rounded-md bg-surface-2 px-2 py-0.5 text-xs text-ink-2 ${rtlBody}`}>
                          {t(DETAIL_KEY[d])}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={`text-xs text-ink-2 ${rtlBody}`}>{t("landing.regions.noDetails")}</p>
                  )}
                  {card.extra && <p className={`text-xs text-ink-3 ${rtlBody}`}>{t(card.extra)}</p>}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-col items-start gap-4 rounded-xl border border-line bg-canvas p-5 sm:flex-row sm:items-center">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-ink"
            aria-hidden="true"
          >
            <Icon name="languages" size={20} />
          </span>
          <p className={`flex-1 ${bodyText}`}>
            <span className="font-semibold text-ink">{t("landing.regions.rtlTitle")}</span>{" "}
            {t("landing.regions.rtlText")}{" "}
            <span lang="ur" dir="rtl" className="font-semibold text-ink [font-family:var(--font-urdu)]">
              اردو
            </span>{" "}
            ·{" "}
            <span lang="ar" dir="rtl" className="font-semibold text-ink [font-family:var(--font-arabic)]">
              العربية
            </span>
          </p>
          <Link
            href={start.primary.href}
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-ink underline-offset-4 hover:underline"
          >
            {t("landing.regions.cta")}
            <Icon name="arrow-right" size={16} className="rtl:rotate-180" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/**
 * A sketch of the top of a CV in this format: photo when the region expects or allows one, then
 * the personal details it shows. Bars stand in for text so no made-up details appear.
 */
function MiniCv({ rules }: { rules: RegionRules }) {
  const t = useT();
  const letter = rules.pageSize === "LETTER";
  return (
    <div aria-hidden="true" className="flex justify-center rounded-lg bg-surface-2 px-4 py-5">
      <div
        className={`flex w-full max-w-[200px] flex-col gap-2.5 rounded-sm bg-surface p-3 shadow-[var(--shadow-sm)] ring-1 ring-line ${letter ? "aspect-[8.5/9]" : "aspect-[210/240]"}`}
      >
        <div className="flex items-center gap-2.5">
          {rules.photo !== "no" && (
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-full text-ink-3 ${rules.photo === "expected" ? "bg-brand-soft text-brand-ink" : "border border-dashed border-line-strong"}`}
            >
              <Icon name="user" size={16} />
            </span>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="h-2 w-3/4 rounded-full bg-ink-2/70" />
            <span className="h-1.5 w-1/2 rounded-full bg-ink-3/50" />
          </div>
        </div>
        {rules.details.length > 0 && (
          <div className="flex flex-col gap-1 border-t border-line pt-2">
            {rules.details.slice(0, 5).map((d) => (
              <div key={d} className="flex items-center gap-1.5">
                <span className={`min-w-0 truncate text-[9px] leading-3 font-semibold text-ink-2 ${rtlBody}`}>
                  {t(DETAIL_KEY[d])}
                </span>
                <span className="h-1 flex-1 rounded-full bg-line-strong" />
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-1 border-t border-line pt-2">
          {[90, 70, 80, 55].map((w, i) => (
            <span key={i} className="h-1 rounded-full bg-line-strong" style={{ inlineSize: `${w}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
