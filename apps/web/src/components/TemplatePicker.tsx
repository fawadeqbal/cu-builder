"use client";

import Link from "next/link";
import { useRef } from "react";
import { ACCENTS, TIERS, type TemplateId } from "@cvb/templates/catalog";
import { CheckIcon, ChevronDownIcon, LockIcon } from "@cvb/ui";
import { isUnlocked, usePlan } from "@/lib/access";
import { useCatalog } from "@/lib/catalog";
import { TierBadge } from "@cvb/ui";

type Props = {
  template: TemplateId;
  accent: string | null;
  onTemplate: (t: TemplateId) => void;
  onAccent: (a: string | null) => void;
  templatesHref: string;
};

/** Toolbar dropdown: switch template and accent quickly, or open the full gallery. */
export function TemplatePicker({ template, accent, onTemplate, onAccent, templatesHref }: Props) {
  const ref = useRef<HTMLDetailsElement>(null);
  const { templates, meta: metaOf } = useCatalog();
  const { plan } = usePlan();
  const meta = metaOf(template);
  const current = accent ?? meta.accent;
  const close = () => ref.current?.removeAttribute("open");

  return (
    <details ref={ref} className="relative [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg py-1.5 ps-2 pe-2.5 text-xs font-medium text-stone-700 ring-1 ring-stone-200 transition hover:bg-stone-50">
        <span className="size-3 rounded-full ring-1 ring-black/10" style={{ background: current }} />
        <span className="max-w-[9rem] truncate">{meta.name}</span>
        <ChevronDownIcon className="size-3.5 text-stone-400" />
      </summary>

      <div className="absolute left-1/2 z-40 mt-2 w-72 -translate-x-1/2 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl">
        <div className="border-b border-stone-100 p-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-stone-800">Accent colour</span>
            {accent && (
              <button type="button" onClick={() => onAccent(null)} className="font-medium text-brand hover:underline">
                Use template colour
              </button>
            )}
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {ACCENTS.map((a) => (
              <button
                key={a.value}
                type="button"
                title={a.name}
                aria-label={a.name}
                aria-pressed={current === a.value}
                onClick={() => onAccent(a.value === meta.accent ? null : a.value)}
                className="grid size-8 place-items-center rounded-full ring-1 ring-black/10 transition hover:scale-110"
                style={{ background: a.value }}
              >
                {current === a.value && <CheckIcon className="size-4 text-white" />}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto p-1.5">
          {TIERS.map((tier) => (
            <div key={tier.id} className="mb-1">
              <div className="px-2 pb-1 pt-2">
                <TierBadge tier={tier.id} />
              </div>
              {templates.filter((t) => t.tier === tier.id).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    onTemplate(t.id);
                    close();
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-start text-sm ${
                    t.id === template ? "bg-brand/[0.07] text-brand" : "text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: t.accent }} />
                  <span className="flex-1 font-medium">{t.name}</span>
                  {!isUnlocked(plan, t.tier) && t.id !== template && <LockIcon className="size-3.5 text-stone-400" aria-label="Preview only, needs an upgrade" />}
                  {t.id === template && <CheckIcon className="size-4" />}
                </button>
              ))}
            </div>
          ))}
        </div>

        <Link
          href={templatesHref}
          className="flex items-center justify-center gap-1.5 border-t border-stone-100 px-3 py-2.5 text-sm font-semibold text-brand hover:bg-brand/[0.04]"
        >
          Browse all templates →
        </Link>
      </div>
    </details>
  );
}
