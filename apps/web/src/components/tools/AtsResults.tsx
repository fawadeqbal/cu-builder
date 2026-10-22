"use client";

import type { AtsCheckDto } from "@cvb/contracts";
import type { AtsIssue, AtsSection } from "@cvb/domain";
import { Alert, Badge, Button, Card, Icon, KeywordList, MatchScore, ProgressBar, ScoreRing } from "@cvb/ui";
import { OpenInBuilder } from "./OpenInBuilder";

const GRADE = {
  excellent: { label: "Excellent", line: "Tracking systems should read it well, and it reads strongly. Fine-tune it for each job." },
  good: { label: "Good", line: "A solid CV. A few fixes below will make it stronger." },
  fair: { label: "Needs work", line: "Systems can read it, but it's missing things recruiters look for. Start with the high-priority fixes." },
  weak: { label: "Weak", line: "Important parts are missing or couldn't be read. Fix the high-priority issues first." },
} as const;

const SEVERITY = {
  high: { label: "High priority", tone: "danger" },
  medium: { label: "Medium", tone: "warning" },
  low: { label: "Low", tone: "neutral" },
} as const;

const SENIORITY_FIT = {
  under: "The advert asks for more experience than your CV shows. Make sure every relevant year and role is on it.",
  over: "Your CV shows a lot more experience than the advert asks for. Consider trimming older roles.",
  match: "Your experience level looks like a match for this advert.",
  unknown: null,
} as const;

function Found({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <li className="flex min-w-0 items-start gap-2.5 py-2">
      <Icon name={ok ? "check-circle" : "alert-triangle"} size={18} className={ok ? "mt-0.5 shrink-0 text-success" : "mt-0.5 shrink-0 text-warning"} />
      <div className="flex min-w-0 flex-col">
        <span className="text-xs font-semibold text-ink-3">{label}</span>
        <span className="truncate text-sm text-ink">{value}</span>
      </div>
    </li>
  );
}

/** Issues grouped under the section they cost points in, worst section first. */
function groupIssues(sections: AtsSection[], issues: AtsIssue[]) {
  return sections
    .map((s) => ({ section: s, issues: issues.filter((i) => i.section === s.id) }))
    .filter((g) => g.issues.length > 0)
    .sort((a, b) => a.section.score / a.section.max - b.section.score / b.section.max);
}

export function AtsResults({ result, onAddJob, onReset }: { result: AtsCheckDto; onAddJob?: () => void; onReset: () => void }) {
  const { report, match, cv, warnings, source } = result;
  const grade = GRADE[report.grade];
  const groups = groupIssues(report.sections, report.issues);
  const p = cv.personal;
  const skillCount = cv.skills.flatMap((s) => s.items.split(/[,;·|\n]/)).filter((s) => s.trim()).length;
  const seniority = match ? SENIORITY_FIT[match.seniority.fit] : null;

  return (
    <section aria-labelledby="results-title" className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <ScoreRing value={report.score} size="lg" label={`ATS score ${report.score} out of 100`} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <h2 id="results-title" className="cvb-h2">
                Your ATS score: {grade.label}
              </h2>
              <p className="text-base leading-7 text-ink-2">{grade.line}</p>
              <ul className="flex flex-wrap gap-2 text-xs text-ink-3">
                <li className="rounded-full bg-surface-2 px-2.5 py-1">{source.words} words</li>
                {source.pages !== null && <li className="rounded-full bg-surface-2 px-2.5 py-1">{source.pages === 1 ? "1 page" : `${source.pages} pages`}</li>}
                <li className="rounded-full bg-surface-2 px-2.5 py-1">
                  {report.stats.quantified} of {report.stats.bullets} lines with a number
                </li>
                <li className="rounded-full bg-surface-2 px-2.5 py-1">
                  {report.stats.actionLed} of {report.stats.bullets} lines start with an action verb
                </li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-lg bg-brand-soft p-4">
            <p className="text-sm leading-6 text-ink">
              <strong>Fix these in the builder.</strong> We&apos;ll open your CV with everything we read already filled in, and the score updates as you edit.
            </p>
            <OpenInBuilder cv={cv} label="Fix these in the builder" offerSignUp />
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-6">
          <Card title="Issues and fixes" description={report.issues.length ? `${report.issues.length} to look at, most important first.` : undefined}>
            {groups.length === 0 ? (
              <Alert tone="success">No issues found. Nice work.</Alert>
            ) : (
              <div className="flex flex-col gap-6">
                {groups.map(({ section, issues }) => (
                  <div key={section.id} className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="cvb-h3">{section.label}</h3>
                      <span className="cvb-caption cvb-num">
                        {section.score}/{section.max}
                      </span>
                    </div>
                    <ul className="flex flex-col gap-2">
                      {issues.map((i) => (
                        <li key={i.id} className="flex flex-col gap-1.5 rounded-lg border border-line p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={SEVERITY[i.severity].tone}>{SEVERITY[i.severity].label}</Badge>
                            <span className="text-sm font-semibold text-ink">{i.message}</span>
                          </div>
                          <p className="flex items-start gap-1.5 text-sm leading-6 text-ink-2">
                            <Icon name="lightbulb" size={16} className="mt-1 shrink-0 text-brand-ink" />
                            {i.fix}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {match ? (
            <Card title="Keywords from the job advert" description="Systems and recruiters look for the advert's own words. Add the missing ones where they're true for you.">
              <div className="flex flex-col gap-4">
                <MatchScore score={match.score} />
                {match.keywords.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    <KeywordList found={match.found} missing={match.missing} required={match.keywords.filter((k) => k.required).map((k) => k.keyword)} />
                    <p className="text-xs text-ink-3">
                      Ticked keywords are on your CV. {match.missing.length > 0 && "Others are missing; ones with a stronger outline are listed as requirements."}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-ink-2">We couldn&apos;t pick out clear skill keywords from this advert. Paste the full description, including the requirements.</p>
                )}
                {!match.titleMatch && <Alert tone="info">Your headline doesn&apos;t match the job title. If the role fits, use the advert&apos;s title under your name.</Alert>}
                {seniority && <p className="text-sm leading-6 text-ink-2">{seniority}</p>}
              </div>
            </Card>
          ) : (
            onAddJob && (
              <Card title="Applying for a specific job?">
                <div className="flex flex-col items-start gap-3">
                  <p className="text-sm leading-6 text-ink-2">Paste the job advert to see which of its keywords your CV already has and which are missing.</p>
                  <Button variant="secondary" icon="target" onClick={onAddJob}>
                    Compare with a job advert
                  </Button>
                </div>
              </Card>
            )
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card title="Section scores">
            <div className="flex flex-col gap-3">
              {report.sections.map((s) => (
                <ProgressBar key={s.id} value={s.score} max={s.max} label={<span className="text-sm text-ink-2">{s.label}</span>} valueLabel={<span className="cvb-num text-sm text-ink-2">{`${s.score}/${s.max}`}</span>} />
              ))}
            </div>
          </Card>

          <Card title="What a tracking system read" description="If something here is wrong or missing, a system may have misread your file too.">
            <ul className="grid grid-cols-1 divide-y divide-line min-[420px]:grid-cols-2 min-[420px]:divide-y-0">
              <Found ok={Boolean(p.name)} label="Name" value={p.name || "Not found"} />
              <Found ok={Boolean(p.headline)} label="Job title" value={p.headline || "Not found"} />
              <Found ok={Boolean(p.email)} label="Email" value={p.email || "Not found"} />
              <Found ok={Boolean(p.phone)} label="Phone" value={p.phone || "Not found"} />
              <Found ok={cv.experience.length > 0} label="Jobs" value={cv.experience.length ? `${cv.experience.length} found` : "None found"} />
              <Found ok={cv.education.length > 0} label="Education" value={cv.education.length ? `${cv.education.length} found` : "None found"} />
              <Found ok={skillCount > 0} label="Skills" value={skillCount ? `${skillCount} listed` : "None found"} />
              <Found ok={Boolean(cv.summary)} label="Summary" value={cv.summary ? "Found" : "Not found"} />
            </ul>
            {warnings.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3 text-sm text-ink-3">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            {source.kind === "file" && (
              <p className="mt-3 border-t border-line pt-3 text-xs leading-5 text-ink-3">
                This check reads your file&apos;s text; it can&apos;t see the design. Columns, tables and text in images can confuse tracking systems, so a one-column layout is the safest choice.
              </p>
            )}
          </Card>

          <Button variant="ghost" icon="undo" onClick={onReset} className="self-start">
            Check another CV
          </Button>
        </div>
      </div>
    </section>
  );
}
