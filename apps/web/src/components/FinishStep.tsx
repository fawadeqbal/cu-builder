"use client";

import Link from "next/link";
import { cvChecks } from "@cvb/domain";
import { STEPS } from "@/lib/steps";
import type { CV } from "@cvb/domain";
import type { TemplateId } from "@cvb/templates/catalog";
import { ACCENTS, CVDocument, TEMPLATES, templateMeta, templateTags } from "@cvb/templates";
import { TierBadge } from "@cvb/ui";

type Props = {
  cv: CV;
  template: TemplateId;
  onTemplate: (t: TemplateId) => void;
  accent: string | null;
  onAccent: (a: string | null) => void;
  onGoTo: (step: number) => void;
  onDownload: () => void;
  onExport: () => void;
};

export function FinishStep({ cv, template, onTemplate, accent, onAccent, onGoTo, onDownload, onExport }: Props) {
  const meta = templateMeta(template);
  const list = cvChecks(cv);
  const done = list.filter((c) => c.ok).length;

  return (
    <div className="flex flex-col gap-7">
      <section className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
        <div className="flex items-start gap-4">
          <div aria-hidden="true" className="relative h-[150px] w-[106px] shrink-0 overflow-hidden rounded-lg bg-stone-100 ring-1 ring-stone-200">
            <div className="absolute left-0 top-0 w-[210mm] origin-top-left scale-[0.134]">
              <div className="paper">
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
              href="/templates"
              className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-stone-700"
            >
              Browse all {TEMPLATES.length} templates →
            </Link>
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-medium text-stone-500">Quick switch</div>
          <div role="radiogroup" aria-label="Template" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {TEMPLATES.map((t) => {
              const active = t.id === template;
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
                  <span className={`text-[11px] font-medium ${active ? "text-brand" : "text-stone-600"}`}>{t.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-medium text-stone-500">Accent colour</span>
            {accent && (
              <button type="button" onClick={() => onAccent(null)} className="font-medium text-brand hover:underline">
                Use template colour
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

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-stone-800">CV check</h3>
          <span className="text-xs text-stone-500">
            {done} of {list.length} complete
          </span>
        </div>
        <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white shadow-xs">
          {list.map((c) => (
            <li key={c.label} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <span
                className={`grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                  c.ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                }`}
                aria-hidden="true"
              >
                {c.ok ? "✓" : "!"}
              </span>
              <span className="flex-1 text-stone-700">
                {c.label}
                {!c.ok && <span className="block text-xs text-stone-500">{c.hint}</span>}
              </span>
              {!c.ok && (
                <button
                  type="button"
                  onClick={() => onGoTo(STEPS.findIndex((s) => s.id === c.step))}
                  className="text-xs font-semibold text-brand hover:underline"
                >
                  Fix
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-brand/5 p-5 ring-1 ring-brand/15">
        <button
          type="button"
          onClick={onDownload}
          className="w-full rounded-xl bg-brand px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-dark"
        >
          Download PDF
        </button>
        <p className="text-xs leading-relaxed text-stone-600">
          Your A4 PDF downloads straight away. The text stays selectable and searchable, and links stay clickable.
        </p>
        <button
          type="button"
          onClick={onExport}
          className="self-start text-sm font-medium text-brand underline-offset-4 hover:underline"
        >
          Save a backup file (.json) to edit later
        </button>
      </section>
    </div>
  );
}
