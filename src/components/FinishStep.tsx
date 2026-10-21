"use client";

import { TEMPLATES } from "@/lib/cv";
import { cvChecks } from "@/lib/progress";
import { STEPS } from "@/lib/steps";
import type { CV, TemplateId } from "@/lib/types";
import { CVDocument } from "@/templates";

type Props = {
  cv: CV;
  template: TemplateId;
  onTemplate: (t: TemplateId) => void;
  onGoTo: (step: number) => void;
  onDownload: () => void;
  onExport: () => void;
};

export function FinishStep({ cv, template, onTemplate, onGoTo, onDownload, onExport }: Props) {
  const list = cvChecks(cv);
  const done = list.filter((c) => c.ok).length;

  return (
    <div className="flex flex-col gap-7">
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-stone-800">Template</h3>
        <div role="radiogroup" aria-label="Template" className="grid grid-cols-2 gap-3">
          {TEMPLATES.map((t) => {
            const active = template === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onTemplate(t.id)}
                className={`group flex flex-col overflow-hidden rounded-2xl border-2 bg-white text-left transition ${
                  active ? "border-brand shadow-sm" : "border-stone-200 hover:border-stone-400"
                }`}
              >
                <div aria-hidden="true" className="relative h-40 overflow-hidden bg-stone-100">
                  <div className="absolute left-1/2 top-3 w-[210mm] origin-top -translate-x-1/2 scale-[0.26]">
                    <div className="paper">
                      <CVDocument cv={cv} template={t.id} />
                    </div>
                  </div>
                </div>
                <div className="flex items-start justify-between gap-2 border-t border-stone-200 px-3 py-2.5">
                  <div>
                    <div className="text-sm font-semibold text-stone-900">{t.name}</div>
                    <div className="text-xs leading-snug text-stone-500">{t.description}</div>
                  </div>
                  <span
                    className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-2 ${
                      active ? "border-brand" : "border-stone-300"
                    }`}
                  >
                    {active && <span className="size-2 rounded-full bg-brand" />}
                  </span>
                </div>
              </button>
            );
          })}
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
