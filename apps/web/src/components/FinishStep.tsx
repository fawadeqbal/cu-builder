"use client";

import type { AtsReport } from "@cvb/domain";
import { STEPS } from "@/lib/steps";
import { applyRegionPreset, REGIONS, type CV, type CVDirection, type CVLanguage, type Region } from "@cvb/domain";
import { LOCALES, useT } from "@/lib/i18n";
import type { TemplateId } from "@cvb/templates/catalog";
import { ACCENTS, CVDocument, templateTags } from "@cvb/templates";
import { Button, Card, Chip, ColorSwatches, Icon, SegmentedControl, Select, TierBadge } from "@cvb/ui";
import { isUnlocked, usePlan } from "@/lib/access";
import { useCatalog } from "@/lib/catalog";
import { EXPORT_LABEL, type ExportActions } from "@/lib/exports";
import { PAGE_SIZES, paperSizeAttr, type PageSize } from "@/lib/page";
import { AtsPanel } from "./ats/AtsPanel";

export type FinishAts = { report: AtsReport; full: boolean; onUnlock: () => void; onOptimise?: () => void };

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
    <div className="flex flex-col gap-6">
      <section className="cvb-card flex flex-col gap-5 p-5">
        <div className="flex items-start gap-4">
          <div aria-hidden="true" className="relative h-[150px] w-[106px] shrink-0 overflow-hidden rounded-xs bg-paper shadow-[var(--shadow-paper)]">
            <div className="absolute start-0 top-0 w-[210mm] origin-top-left scale-[0.134] rtl:origin-top-right">
              <div className="paper" data-size={paperSizeAttr(actions.pageSize)}>
                <CVDocument cv={cv} template={template} accent={accent} />
              </div>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="cvb-h3">{meta.name}</h3>
              <TierBadge tier={meta.tier} />
            </div>
            <p className="text-sm text-ink-2">{meta.description}</p>
            <p className="cvb-caption">{templateTags(meta)}</p>
            <Button variant="secondary" size="sm" icon="template" href={actions.templatesHref} className="mt-1 w-fit">
              {t("finish.browse", { count: templates.length })}
            </Button>
          </div>
        </div>

        <div>
          <div className="cvb-label mb-2">{t("finish.quickSwitch")}</div>
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
                  className={`flex w-[68px] shrink-0 flex-col items-center gap-1 rounded-md p-1 transition focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none ${
                    active ? "bg-brand-soft" : "hover:bg-surface-2"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`relative block h-[84px] w-[60px] overflow-hidden rounded-xs bg-paper ${active ? "ring-2 ring-brand" : "ring-1 ring-line"}`}
                  >
                    <span className="absolute start-0 top-0 block w-[210mm] origin-top-left scale-[0.0756] rtl:origin-top-right">
                      <span className="paper block">
                        <CVDocument cv={cv} template={t.id} accent={accent} />
                      </span>
                    </span>
                  </span>
                  <span className={`flex items-center gap-0.5 text-xs ${active ? "font-semibold text-ink" : "font-medium text-ink-2"}`}>
                    {locked && <Icon name="lock" size={12} label="Needs an upgrade" />}
                    {t.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="cvb-label">{t("finish.accent")}</span>
            {accent && (
              <Button variant="link" size="sm" onClick={() => onAccent(null)}>
                {t("finish.templateColour")}
              </Button>
            )}
          </div>
          <ColorSwatches
            label={t("finish.accent")}
            colors={ACCENTS.map((a) => ({ value: a.value, name: a.name }))}
            value={accent ?? meta.accent}
            onChange={(v) => onAccent(v === meta.accent ? null : v)}
          />
        </div>
      </section>

      <FormatPanel cv={cv} onChange={onChange} actions={actions} template={template} onTemplate={onTemplate} />

      <AtsPanel report={ats.report} full={ats.full} onUnlock={ats.onUnlock} onOptimise={ats.onOptimise} onFix={(step) => onGoTo(STEPS.findIndex((s) => s.id === step))} />

      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="cvb-label">{t("finish.pageSize")}</span>
            <SegmentedControl
              label="Page size"
              size="sm"
              value={actions.pageSize}
              onChange={(size: PageSize) => actions.onPageSize(size)}
              options={(Object.keys(PAGE_SIZES) as PageSize[]).map((size) => ({ value: size, label: PAGE_SIZES[size].label }))}
            />
          </div>
          <Button variant="primary" size="lg" block icon="download" loading={actions.busy === "pdf"} onClick={() => actions.exportAs("pdf")}>
            {actions.busy === "pdf" ? t("wizard.preparingPdf") : t("wizard.downloadPdf")}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            {(["docx", "txt"] as const).map((f) => (
              <Button key={f} variant="secondary" icon={actions.locked.includes(f) ? "lock" : undefined} loading={actions.busy === f} onClick={() => actions.exportAs(f)}>
                {actions.busy === f ? t("finish.preparing") : EXPORT_LABEL[f]}
              </Button>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-ink-3">{t("finish.exportNote")}</p>
          <Button variant="link" size="sm" icon="download" className="self-start" onClick={() => actions.exportAs("json")}>
            {t("finish.backup")}
          </Button>
        </div>
      </Card>
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

  return (
    <Card title={t("region.title")} description={t("region.desc")}>
      <div className="flex flex-col gap-4">
        <div role="group" aria-label={t("region.title")} className="flex flex-wrap gap-2">
          {REGIONS.map((r) => (
            <Chip key={r} selected={region === r} onClick={() => choose(r)}>
              {t(`region.${r}`)}
            </Chip>
          ))}
        </div>
        {suggested && suggested !== template && (
          <Button variant="link" size="sm" icon="template" className="self-start" onClick={() => onTemplate(suggested)}>
            {t("region.useTemplate", { name: metaOf(suggested).name })}
          </Button>
        )}
        <div className="cvb-field-row">
          <Select
            label={t("dir.title")}
            value={cv.settings.direction}
            onChange={(e) => set({ direction: e.target.value as CVDirection })}
            options={[
              { value: "auto", label: t("dir.auto") },
              { value: "ltr", label: t("dir.ltr") },
              { value: "rtl", label: t("dir.rtl") },
            ]}
          />
          <Select label={t("cvlang.title")} value={cv.settings.language} onChange={(e) => set({ language: e.target.value as CVLanguage })}>
            <option value="auto">{t("cvlang.auto")}</option>
            {LOCALES.map((l) => (
              <option key={l.code} value={l.code} lang={l.code}>
                {l.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </Card>
  );
}

