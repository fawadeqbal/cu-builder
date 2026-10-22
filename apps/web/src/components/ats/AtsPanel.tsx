"use client";

import type { AtsReport } from "@cvb/domain";
import type { StepId } from "@/lib/steps";
import { Alert, Button, ProgressBar, ScoreRing } from "@cvb/ui";

const GRADE = { excellent: "Excellent", good: "Good", fair: "Needs work", weak: "Weak" } as const;
const SEVERITY = { high: "danger", medium: "warning", low: "info" } as const;
/** Issues everyone sees before the full report needs a plan. */
const PREVIEW = 2;

type Props = {
  report: AtsReport;
  /** The plan includes the full report. */
  full: boolean;
  onFix: (step: StepId) => void;
  onUnlock: () => void;
  compact?: boolean;
  /** Inside the ATS report dialog: no card around it and the large ring. */
  inDialog?: boolean;
};

/** The ATS score and report: sections with points, and every issue with a one-line fix. */
export function AtsPanel({ report, full, onFix, onUnlock, compact = false, inDialog = false }: Props) {
  const issues = full ? report.issues : report.issues.slice(0, PREVIEW);
  const hidden = report.issues.length - issues.length;
  return (
    <section className={inDialog ? "flex flex-col gap-5" : "cvb-card flex flex-col gap-4 p-5"}>
      <div className="flex items-center gap-4">
        <ScoreRing value={report.score} size={inDialog ? "lg" : "md"} label={`ATS score ${report.score} out of 100`} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="cvb-h3">ATS score · {GRADE[report.grade]}</h3>
          <p className="text-sm text-ink-3">
            How well tracking systems can read your CV and how strong it looks to a recruiter. {report.stats.quantified} of {report.stats.bullets} lines have a number.
          </p>
        </div>
      </div>

      {!compact && (
        <div className="grid grid-cols-1 gap-x-5 gap-y-3 min-[420px]:grid-cols-2 sm:grid-cols-3">
          {report.sections.map((s) => (
            <ProgressBar
              key={s.id}
              value={full ? s.score : 0}
              max={s.max}
              label={<span className="text-xs text-ink-2">{s.label}</span>}
              valueLabel={<span className="text-xs text-ink-2">{full ? `${s.score}/${s.max}` : "—"}</span>}
            />
          ))}
        </div>
      )}

      {issues.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {issues.map((i) => (
            <li key={i.id}>
              <Alert
                tone={SEVERITY[i.severity]}
                title={
                  <>
                    <span className="cvb-sr">{`${i.severity} priority: `}</span>
                    {i.message}
                  </>
                }
                actions={
                  <Button size="sm" variant="secondary" onClick={() => onFix(i.step)}>
                    Fix
                  </Button>
                }
              >
                {i.fix}
              </Alert>
            </li>
          ))}
        </ul>
      ) : (
        <Alert tone="success">No issues found. Nice work.</Alert>
      )}

      {hidden > 0 && (
        <Button variant="highlight" icon="lock" block onClick={onUnlock}>
          See all {report.issues.length} issues and section scores
        </Button>
      )}
    </section>
  );
}
