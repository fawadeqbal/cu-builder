"use client";

import { Icon } from "@cvb/ui";
import { useT } from "@/lib/i18n";

/** "From LinkedIn": the two ways to get a file LinkedIn can give you, folded away until asked for. */
export function LinkedInImportHelp({ className = "" }: { className?: string }) {
  const t = useT();
  return (
    <details className={`group w-full max-w-md text-start [&_summary::-webkit-details-marker]:hidden ${className}`}>
      <summary className="mx-auto flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 rounded-md px-2 text-sm font-semibold text-brand-ink hover:underline focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none">
        <Icon name="briefcase" size={16} />
        {t("li.title")}
        <Icon name="chevron-down" size={16} className="transition group-open:rotate-180" />
      </summary>
      <ol className="mt-2 flex list-none flex-col gap-3 rounded-lg border border-line bg-surface p-4 text-sm leading-relaxed text-ink-2">
        <li className="flex flex-col gap-1">
          <strong className="text-ink">{t("li.exportTitle")}</strong>
          <span>{t("li.exportSteps")}</span>
          <span className="cvb-caption">{t("li.exportNote")}</span>
        </li>
        <li className="flex flex-col gap-1 border-t border-line pt-3">
          <strong className="text-ink">{t("li.pdfTitle")}</strong>
          <span>{t("li.pdfSteps")}</span>
        </li>
      </ol>
    </details>
  );
}
