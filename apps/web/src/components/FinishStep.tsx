"use client";

import Link from "next/link";
import type { AtsReport } from "@cvb/domain";
import { STEPS } from "@/lib/steps";
import { applyRegionPreset, REGIONS, type CV, type CVDirection, type CVLanguage, type Region } from "@cvb/domain";
import { LOCALES, useT } from "@/lib/i18n";
import type { TemplateId } from "@cvb/templates/catalog";
import { ACCENTS, CVDocument, templateTags } from "@cvb/templates";
import { LockIcon, TierBadge } from "@cvb/ui";
import { isUnlocked, usePlan } from "@/lib/access";
import { useCatalog } from "@/lib/catalog";
import { EXPORT_LABEL, type ExportActions } from "@/lib/exports";
import { PAGE_SIZES, paperSizeAttr, type PageSize } from "@/lib/page";
import { AtsPanel } from "./ats/AtsPanel";

export type FinishAts = { report: AtsReport; full: boolean; onUnlock: () => void };

type Props = {
  cv: CV;
  onChange: (cv: CV) => void;
  template: TemplateId;
  onTemplate: (t: TemplateId) => void;
  accent: string | null;
  onAccent: (a: string | null) => void;
  onGoTo: (step: number) => void;
  actions: ExportActions;
  ats: FinishAts;
};

export function FinishStep({ cv, onChange, template, onTemplate, accent, onAccent, onGoTo, actions, ats }: Props) {
  const t = useT();
  const { templates, meta: metaOf } = useCatalog();
  const { plan } = usePlan();
  const meta = metaOf(template);

  return (
    <div className="flex flex-col gap-7">
      <section className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
        <div className="flex items-start gap-4">
          <div aria-hidden="true" className="relative h-[150px] w-[106px] shrink-0 overflow-hidden rounded-lg bg-stone-100 ring-1 ring-stone-200">
            <div className="absolute left-0 top-0 w-[210mm] origin-top-left scale-[0.134]">
              <div className="paper" data-size={paperSizeAttr(actions.pageSize)}>
                <CVDocument cv={cv} template={template} accent={accent} />
              </div>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-stone-900">{meta.name}</h3>
              <TierBadge tier={meta.tier} />
            </div>
            <p className="text-sm text-stone-600">{meta.description}</p>
            <p className="text-xs text-stone-500">
              {templateTags(meta)}
            </p>
            <Link
              href={actions.templatesHref}
              className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-stone-700"
            >
              {t("finish.browse", { count: templates.length })}
            </Link>
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-medium text-stone-500">{t("finish.quickSwitch")}</div>
          <div role="radiogroup" aria-label="Template" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {templates.map((t) => {
              const active = t.id === template;
              const locked = !isUnlocked(plan, t.tier);
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  title={`${t.name} · ${t.description}`}
                  onClick={() => onTemplate(t.id)}
                  className={`flex w-[68px] shrink-0 flex-col items-center gap-1 rounded-lg p-1 transition ${
                    active ? "bg-brand/[0.07]" : "hover:bg-stone-50"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`relative block h-[84px] w-[60px] overflow-hidden rounded-md bg-white ring-1 ${
                      active ? "ring-2 ring-brand" : "ring-stone-200"
                    }`}
                  >
                    <span className="absolute left-0 top-0 block w-[210mm] origin-top-left scale-[0.0756]">
                      <span className="paper block">
                        <CVDocument cv={cv} template={t.id} accent={accent} />
                      </span>
                    </span>
                  </span>
                  <span className={`flex items-center gap-0.5 text-[11px] font-medium ${active ? "text-brand" : "text-stone-600"}`}>
                    {locked && <LockIcon className="size-2.5" aria-label="Needs an upgrade" />}
                    {t.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-medium text-stone-500">{t("finish.accent")}</span>
            {accent && (
              <button type="button" onClick={() => onAccent(null)} className="font-medium text-brand hover:underline">
                {t("finish.templateColour")}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ACCENTS.map((a) => {
              const on = (accent ?? meta.accent) === a.value;
              return (
                <button
                  key={a.value}
                  type="button"
                  title={a.name}
                  aria-label={a.name}
                  aria-pressed={on}
                  onClick={() => onAccent(a.value === meta.accent ? null : a.value)}
                  className={`size-7 rounded-full ring-1 ring-black/10 transition hover:scale-110 ${on ? "outline-2 outline-offset-2 outline-stone-900" : ""}`}
                  style={{ background: a.value }}
                />
              );
            })}
          </div>
        </div>
      </section>

      <FormatPanel cv={cv} onChange={onChange} actions={actions} template={template} onTemplate={onTemplate} />

      <AtsPanel report={ats.report} full={ats.full} onUnlock={ats.onUnlock} onFix={(step) => onGoTo(STEPS.findIndex((s) => s.id === step))} />

      <section className="flex flex-col gap-4 rounded-2xl bg-brand/5 p-5 ring-1 ring-brand/15">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-stone-600">{t("finish.pageSize")}</span>
          <div role="radiogroup" aria-label="Page size" className="flex rounded-lg bg-white p-0.5 text-xs ring-1 ring-inset ring-stone-200">
            {(Object.keys(PAGE_SIZES) as PageSize[]).map((size) => (
              <button
                key={size}
                type="button"
                role="radio"
                aria-checked={actions.pageSize === size}
                onClick={() => actions.onPageSize(size)}
                className={`rounded-md px-2.5 py-1 font-medium ${actions.pageSize === size ? "bg-brand text-white" : "text-stone-600 hover:text-stone-900"}`}
              >
                {PAGE_SIZES[size].label}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => actions.exportAs("pdf")}
          disabled={actions.busy === "pdf"}
          className="w-full rounded-xl bg-brand px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-dark disabled:cursor-wait disabled:opacity-80"
        >
          {actions.busy === "pdf" ? t("wizard.preparingPdf") : t("wizard.downloadPdf")}
        </button>
        <div className="grid grid-cols-2 gap-2">
          {(["docx", "txt"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => actions.exportAs(f)}
              disabled={actions.busy === f}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-stone-800 ring-1 ring-inset ring-stone-200 hover:bg-stone-50"
            >
              {actions.locked.includes(f) && <LockIcon className="size-3.5 text-stone-400" />}
              {actions.busy === f ? t("finish.preparing") : EXPORT_LABEL[f]}
            </button>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-stone-600">
          {t("finish.exportNote")}
        </p>
        <button
          type="button"
          onClick={() => actions.exportAs("json")}
          className="self-start text-sm font-medium text-brand underline-offset-4 hover:underline"
        >
          {t("finish.backup")}
        </button>
      </section>
    </div>
  );
}

/** Country format (page size, photo, personal details), writing direction and heading language. */
function FormatPanel({
  cv,
  onChange,
  actions,
  template,
  onTemplate,
}: {
  cv: CV;
  onChange: (cv: CV) => void;
  actions: ExportActions;
  template: TemplateId;
  onTemplate: (t: TemplateId) => void;
}) {
  const t = useT();
  const { meta: metaOf } = useCatalog();
  const region = cv.settings.region;
  const suggested = applyRegionPreset(cv, region).template as TemplateId | undefined;
  const set = (patch: Partial<CV["settings"]>) => onChange({ ...cv, settings: { ...cv.settings, ...patch } });

  function choose(next: Region) {
    const out = applyRegionPreset(cv, next);
    onChange(out.cv);
    if (out.pageSize !== actions.pageSize) actions.onPageSize(out.pageSize);
  }

  const select = "w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm text-stone-800";
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
      <div>
        <h3 className="text-sm font-semibold text-stone-900">{t("region.title")}</h3>
        <p className="text-xs text-stone-500">{t("region.desc")}</p>
      </div>
      <div role="radiogroup" aria-label={t("region.title")} className="flex flex-wrap gap-1.5">
        {REGIONS.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={region === r}
            onClick={() => choose(r)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${region === r ? "bg-brand text-white ring-brand" : "bg-white text-stone-700 ring-stone-200 hover:ring-stone-300"}`}
          >
            {t(`region.${r}`)}
          </button>
        ))}
      </div>
      {suggested && suggested !== template && (
        <button type="button" onClick={() => onTemplate(suggested)} className="self-start text-sm font-medium text-brand hover:underline">
          {t("region.useTemplate", { name: metaOf(suggested).name })}
        </button>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          {t("dir.title")}
          <select className={select} value={cv.settings.direction} onChange={(e) => set({ direction: e.target.value as CVDirection })}>
            <option value="auto">{t("dir.auto")}</option>
            <option value="ltr">{t("dir.ltr")}</option>
            <option value="rtl">{t("dir.rtl")}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          {t("cvlang.title")}
          <select className={select} value={cv.settings.language} onChange={(e) => set({ language: e.target.value as CVLanguage })}>
            <option value="auto">{t("cvlang.auto")}</option>
            {LOCALES.map((l) => (
              <option key={l.code} value={l.code} lang={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

