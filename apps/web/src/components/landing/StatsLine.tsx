"use client";

import { showStatsLine } from "@cvb/domain";
import { Icon } from "@cvb/ui";
import { useI18n } from "@/lib/i18n";
import { usePublicStats } from "@/lib/trust";
import { formatCount, rtlBody } from "./shared";

/**
 * Real usage numbers from the API, rounded down. Shown only while this week's count passes its
 * threshold (the API withholds smaller figures); otherwise nothing renders at all.
 */
export function StatsLine() {
  const { t, locale } = useI18n();
  const stats = usePublicStats().data;
  if (!stats || !showStatsLine(stats)) return null;
  const n = (v: number) => formatCount(v, locale);
  const parts = [
    stats.cvsLast7Days !== null && t("landing.stats.week", { n: n(stats.cvsLast7Days) }),
    stats.cvsTotal !== null && t("landing.stats.total", { n: n(stats.cvsTotal) }),
    stats.pdfsTotal !== null
      ? t("landing.stats.pdfs", { n: n(stats.pdfsTotal) })
      : stats.pdfsLast7Days !== null && t("landing.stats.pdfsWeek", { n: n(stats.pdfsLast7Days) }),
  ].filter((x): x is string => Boolean(x));
  return (
    <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-ink-2 ${rtlBody}`}>
      <Icon name="bar-chart" size={16} className="shrink-0 text-brand-ink" />
      {parts.map((p, i) => (
        <span key={p} className="inline-flex items-center gap-2">
          {i > 0 && (
            <span aria-hidden="true" className="text-ink-3">
              ·
            </span>
          )}
          {p}
        </span>
      ))}
    </p>
  );
}
