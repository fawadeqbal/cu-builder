"use client";

import type { AtsReport } from "@cvb/domain";
import type { StepId } from "@/lib/steps";
import { LockIcon } from "@cvb/ui";
import { ScoreRing } from "./ScoreRing";

const GRADE = { excellent: "Excellent", good: "Good", fair: "Needs work", weak: "Weak" } as const;
const SEVERITY = { high: "bg-red-500", medium: "bg-amber-400", low: "bg-stone-300" } as const;
/** Issues everyone sees before the full report needs a plan. */
const PREVIEW = 2;

type Props = {
  report: AtsReport;
  /** The plan includes the full report. */
  full: boolean;
  onFix: (step: StepId) => void;
  onUnlock: () => void;
  compact?: boolean;
};

/** The ATS score and report: sections with points, and every issue with a one-line fix. */
export function AtsPanel({ report, full, onFix, onUnlock, compact = false }: Props) {
  const issues = full ? report.issues : report.issues.slice(0, PREVIEW);
  const hidden = report.issues.length - issues.length;
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
      <div className="flex items-center gap-4">
        <ScoreRing score={report.score} label="ATS score" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-stone-900">ATS score · {GRADE[report.grade]}</h3>
          <p className="text-xs text-stone-500">
            How well tracking systems can read your CV and how strong it looks to a recruiter. {report.stats.quantified} of {report.stats.bullets} lines have a number.
          </p>
        </div>
      </div>

      {!compact && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
          {report.sections.map((s) => (
            <div key={s.id}>
              <div className="flex justify-between text-[11px] text-stone-600">
                <span>{s.label}</span>
                <span className="tabular-nums">
                  {full ? `${s.score}/${s.max}` : "—"}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100">
                <div className="h-full rounded-full bg-brand" style={{ width: full ? `${(s.score / s.max) * 100}%` : "0%" }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {issues.length > 0 ? (
        <ul className="divide-y divide-stone-100 rounded-xl border border-stone-100">
          {issues.map((i) => (
            <li key={i.id} className="flex items-start gap-3 px-3 py-2.5 text-sm">
              <span className={`mt-1.5 size-2 shrink-0 rounded-full ${SEVERITY[i.severity]}`} aria-label={`${i.severity} priority`} />
              <span className="min-w-0 flex-1">
                <span className="text-stone-800">{i.message}</span>
                <span className="block text-xs text-stone-500">{i.fix}</span>
              </span>
              <button type="button" onClick={() => onFix(i.step)} className="shrink-0 text-xs font-semibold text-brand hover:underline">
                Fix
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">No issues found. Nice work.</p>
      )}

      {hidden > 0 && (
        <button
          type="button"
          onClick={onUnlock}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-stone-900 px-3 py-2 text-sm font-semibold text-white hover:bg-stone-700"
        >
          <LockIcon className="size-4" /> See all {report.issues.length} issues and section scores
        </button>
      )}
    </section>
  );
}
