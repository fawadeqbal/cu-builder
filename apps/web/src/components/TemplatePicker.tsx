"use client";

import Link from "next/link";
import { ACCENTS, TIERS, type TemplateId } from "@cvb/templates/catalog";
import { ColorSwatches, Dropdown, Icon, TierBadge } from "@cvb/ui";
import { isUnlocked, usePlan } from "@/lib/access";
import { useCatalog } from "@/lib/catalog";

type Props = {
  template: TemplateId;
  accent: string | null;
  onTemplate: (t: TemplateId) => void;
  onAccent: (a: string | null) => void;
  templatesHref: string;
};

/** Toolbar dropdown: switch template and accent quickly, or open the full gallery. */
export function TemplatePicker({ template, accent, onTemplate, onAccent, templatesHref }: Props) {
  const { templates, meta: metaOf } = useCatalog();
  const { plan } = usePlan();
  const meta = metaOf(template);
  const current = accent ?? meta.accent;

  return (
    <Dropdown
      align="start"
      label="Template"
      trigger={(p) => (
        <button
          type="button"
          onClick={p.toggle}
          aria-expanded={p["aria-expanded"]}
          className="flex h-8 cursor-pointer items-center gap-2 rounded-md border border-line-control bg-surface ps-2 pe-2.5 text-xs font-medium text-ink-2 transition hover:bg-surface-2 hover:text-ink"
        >
          <span
            className="size-3 rounded-full ring-1 ring-line-strong"
            style={{ background: current }}
            aria-hidden="true"
          />
          <span className="max-w-[9rem] truncate">{meta.name}</span>
          <Icon name="chevron-down" size={14} className="text-ink-3" />
        </button>
      )}
    >
      {(close) => (
        <div className="w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
          <div className="flex flex-col gap-2 border-b border-line p-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-ink">Accent colour</span>
              {accent && (
                <button
                  type="button"
                  onClick={() => onAccent(null)}
                  className="font-medium text-brand-ink hover:underline"
                >
                  Use template colour
                </button>
              )}
            </div>
            <ColorSwatches
              label="Accent colour"
              colors={ACCENTS}
              value={current}
              onChange={(a) => onAccent(a === meta.accent ? null : a)}
            />
          </div>

          <div className="max-h-72 overflow-y-auto p-1.5">
            {TIERS.map((tier) => (
              <div key={tier.id} className="mb-1">
                <div className="px-2 pb-1 pt-2">
                  <TierBadge tier={tier.id} />
                </div>
                {templates
                  .filter((t) => t.tier === tier.id)
                  .map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      aria-current={t.id === template ? "true" : undefined}
                      onClick={() => {
                        onTemplate(t.id);
                        close();
                      }}
                      className={`flex min-h-9 w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-start text-sm ${
                        t.id === template
                          ? "bg-brand-soft font-semibold text-ink"
                          : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                      }`}
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-full ring-1 ring-line-strong"
                        style={{ background: t.accent }}
                        aria-hidden="true"
                      />
                      <span className="flex-1 font-medium">{t.name}</span>
                      {!isUnlocked(plan, t.tier) && t.id !== template && (
                        <span className="text-ink-3" role="img" aria-label="Preview only, needs an upgrade">
                          <Icon name="lock" size={14} />
                        </span>
                      )}
                      {t.id === template && <Icon name="check" size={16} className="text-brand-ink" />}
                    </button>
                  ))}
              </div>
            ))}
          </div>

          <Link
            href={templatesHref}
            className="flex items-center justify-center gap-1.5 border-t border-line px-3 py-2.5 text-sm font-semibold text-brand-ink hover:bg-surface-2"
          >
            Browse all templates
            <Icon name="arrow-right" size={16} />
          </Link>
        </div>
      )}
    </Dropdown>
  );
}
