"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cvStrength, stepState } from "@cvb/domain";
import { useT } from "@/lib/i18n";
import { useSteps, type StepId } from "@/lib/steps";
import type { CV } from "@cvb/domain";
import type { TemplateId } from "@cvb/templates/catalog";
import type { ExportActions } from "@/lib/exports";
import { FinishStep, type FinishAts } from "./FinishStep";
import {
  Alert,
  Badge,
  BriefcaseIcon,
  Button,
  CapIcon,
  DownloadIcon,
  FolderIcon,
  GlobeIcon,
  Icon,
  ScoreRing,
  SparkIcon,
  StepRail as DsStepRail,
  TextIcon,
  UserIcon,
  type IconName,
  type Step,
} from "@cvb/ui";
import {
  EducationSection,
  ExperienceSection,
  ExtrasSection,
  PersonalSection,
  ProjectsSection,
  SkillsSection,
  SummarySection,
  type PersonalErrors,
} from "./sections";

type Props = {
  cv: CV;
  onChange: (cv: CV) => void;
  step: number;
  onStep: (step: number) => void;
  template: TemplateId;
  onTemplate: (t: TemplateId) => void;
  accent: string | null;
  onAccent: (a: string | null) => void;
  actions: ExportActions;
  ats: FinishAts;
};

export const STEP_ICONS: Record<StepId, (p: { className?: string }) => ReactNode> = {
  personal: UserIcon,
  summary: TextIcon,
  experience: BriefcaseIcon,
  education: CapIcon,
  skills: SparkIcon,
  projects: FolderIcon,
  extras: GlobeIcon,
  finish: DownloadIcon,
};

/** The same steps as Folio icon names, for the design-system step rail. */
const STEP_ICON_NAMES: Record<StepId, IconName> = {
  personal: "user",
  summary: "list",
  experience: "briefcase",
  education: "graduation-cap",
  skills: "sparkle",
  projects: "files",
  extras: "globe",
  finish: "download",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function personalErrors(cv: CV, t: ReturnType<typeof useT>): PersonalErrors {
  const p = cv.personal;
  const errors: PersonalErrors = {};
  if (!p.name.trim()) errors.name = t("wizard.errName");
  if (!p.headline.trim()) errors.headline = t("wizard.errHeadline");
  if (!p.email.trim()) errors.email = t("wizard.errEmail");
  else if (!EMAIL.test(p.email.trim())) errors.email = t("wizard.errEmailFormat");
  return errors;
}

/** Whether the list behind an optional step is still empty, so "Skip" makes sense. */
function isEmptyStep(cv: CV, id: string): boolean {
  if (id === "experience") return cv.experience.length === 0;
  if (id === "education") return cv.education.length === 0;
  if (id === "projects") return cv.projects.length === 0;
  if (id === "extras") return cv.languages.length + cv.certificates.length === 0;
  return false;
}

/**
 * The step-by-step editor: a step rail on the left (icons only when the pane is narrow,
 * a compact dropdown on phones) and the current step's form on the right.
 */
export function Wizard({ cv, onChange, step, onStep, template, onTemplate, accent, onAccent, actions, ats }: Props) {
  const STEPS = useSteps();
  const t = useT();
  const index = Math.min(Math.max(step, 0), STEPS.length - 1);
  const current = STEPS[index];
  const [showErrors, setShowErrors] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const errors = current.id === "personal" ? personalErrors(cv, t) : {};
  const hasErrors = Object.keys(errors).length > 0;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [index]);

  function goTo(next: number) {
    // Leaving the first step forwards needs its required fields.
    if (next > index && hasErrors) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    onStep(Math.min(Math.max(next, 0), STEPS.length - 1));
  }

  const next = STEPS[index + 1];
  const skip = current.optional && isEmptyStep(cv, current.id);
  const strength = cvStrength(cv);

  return (
    <div className="@container flex h-full min-h-0 bg-canvas">
      <StepRail cv={cv} index={index} onGo={goTo} strength={strength} />

      <div className="flex min-w-0 flex-1 flex-col">
        <CompactStepper cv={cv} index={index} onGo={goTo} strength={strength} />

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 pb-10 pt-6 @min-[560px]:px-8 @min-[560px]:pt-10">
            <header className="flex items-start gap-4">
              <span className="hidden size-11 shrink-0 place-items-center rounded-lg border border-line bg-surface text-brand-ink @min-[560px]:grid">
                <Icon name={STEP_ICON_NAMES[current.id]} size={20} />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <p className="flex items-center gap-2">
                  <span className="cvb-overline">{t("wizard.stepOf", { n: index + 1, total: STEPS.length })}</span>
                  {current.optional && <Badge pill>{t("common.optional")}</Badge>}
                </p>
                <h2 className="cvb-h2">{current.title}</h2>
                <p className="text-sm leading-relaxed text-ink-2">{current.intro}</p>
              </div>
            </header>

            {showErrors && hasErrors && <Alert tone="danger">{t("wizard.fixFields")}</Alert>}

            {current.id === "personal" && <PersonalSection cv={cv} onChange={onChange} errors={showErrors ? errors : {}} />}
            {current.id === "summary" && <SummarySection cv={cv} onChange={onChange} />}
            {current.id === "experience" && <ExperienceSection cv={cv} onChange={onChange} />}
            {current.id === "education" && <EducationSection cv={cv} onChange={onChange} />}
            {current.id === "skills" && <SkillsSection cv={cv} onChange={onChange} />}
            {current.id === "projects" && <ProjectsSection cv={cv} onChange={onChange} />}
            {current.id === "extras" && <ExtrasSection cv={cv} onChange={onChange} />}
            {current.id === "finish" && (
              <FinishStep cv={cv} onChange={onChange} template={template} onTemplate={onTemplate} accent={accent} onAccent={onAccent} onGoTo={goTo} actions={actions} ats={ats} />
            )}

            {current.tips.length > 0 && <Tips tips={current.tips} />}
          </div>
        </div>

        <footer className="flex items-center gap-2 border-t border-line bg-surface px-4 py-3 @min-[560px]:px-6">
          <Button variant="ghost" icon="arrow-left" onClick={() => goTo(index - 1)} disabled={index === 0} className="disabled:invisible">
            {t("common.back")}
          </Button>
          <div className="ms-auto flex items-center gap-2">
            {next && skip && (
              <Button variant="ghost" onClick={() => goTo(index + 1)}>
                {t("common.skip")}
              </Button>
            )}
            {next ? (
              <Button variant="primary" iconEnd="arrow-right" onClick={() => goTo(index + 1)}>
                {t("wizard.continueTo", { step: next.short })}
              </Button>
            ) : (
              // The finish step has its own primary download button; this one repeats it quietly.
              <Button variant="secondary" icon="download" onClick={() => actions.exportAs("pdf")} disabled={actions.busy === "pdf"}>
                {actions.busy === "pdf" ? t("wizard.preparingPdf") : t("wizard.downloadPdf")}
              </Button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

type NavProps = { cv: CV; index: number; onGo: (i: number) => void; strength: number };

function useRailSteps(cv: CV, index: number): Step[] {
  const STEPS = useSteps();
  return STEPS.map((s, i) => {
    const state = stepState(cv, s.id);
    const needsWork = state.meta.includes("required");
    return {
      id: s.id,
      label: s.short,
      meta: needsWork ? <span className="text-warning">{state.meta}</span> : state.meta,
      icon: STEP_ICON_NAMES[s.id],
      status: i === index ? "current" : state.done ? "done" : "todo",
    };
  });
}

/** The design-system step rail: labels from 640px of pane width, icons only from 440px, hidden below. */
function StepRail({ cv, index, onGo, strength }: NavProps) {
  const t = useT();
  const steps = useRailSteps(cv, index);
  const pct = Math.round(strength * 100);
  return (
    <aside className="hidden w-[68px] shrink-0 flex-col border-e border-line bg-surface @min-[440px]:flex @min-[640px]:w-[248px]">
      <div className="flex items-center justify-center gap-3 border-b border-line px-3 py-4 @min-[640px]:justify-start @min-[640px]:px-5">
        <span title={`${t("wizard.strength")} ${pct}%`}>
          <ScoreRing value={pct} size="sm" label={`${t("wizard.strength")} ${pct}%`} tone={pct >= 100 ? "success" : "brand"} />
        </span>
        <div className="hidden min-w-0 @min-[640px]:block">
          <div className="text-sm font-semibold text-ink">{t("wizard.strength")}</div>
          <div className="cvb-caption">{pct === 100 ? t("wizard.ready") : pct >= 60 ? t("wizard.almost") : t("wizard.keepGoing")}</div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3 @min-[640px]:px-3">
        <div className="hidden @min-[640px]:block">
          <DsStepRail steps={steps} label={t("wizard.steps")} onSelect={onGo} />
        </div>
        <div className="flex justify-center @min-[640px]:hidden">
          <DsStepRail steps={steps} label={t("wizard.steps")} onSelect={onGo} compact />
        </div>
      </div>
    </aside>
  );
}

/** Phones: the current step with a segmented bar; tapping it lists every step. */
function CompactStepper({ cv, index, onGo, strength }: NavProps) {
  const ref = useRef<HTMLDetailsElement>(null);
  const STEPS = useSteps();
  const t = useT();
  const current = STEPS[index];
  return (
    <details ref={ref} className="group relative border-b border-line bg-surface @min-[440px]:hidden [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-3 focus-visible:shadow-[inset_0_0_0_2px_var(--focus)] focus-visible:outline-none">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-on-brand">
          <Icon name={STEP_ICON_NAMES[current.id]} size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">{current.short}</span>
          <span className="cvb-caption block">
            {t("wizard.stepOf", { n: index + 1, total: STEPS.length })} · <span className="cvb-num">{Math.round(strength * 100)}%</span>
          </span>
        </span>
        <Icon name="chevron-down" size={18} className="text-ink-3 transition group-open:rotate-180" />
      </summary>
      <div className="flex gap-1 px-4 pb-3" aria-hidden="true">
        {STEPS.map((s, i) => (
          <span key={s.id} className={`h-1 flex-1 rounded-full ${i === index ? "bg-brand" : stepState(cv, s.id).done ? "bg-success" : "bg-surface-3"}`} />
        ))}
      </div>
      <ol className="cvb-menu absolute inset-x-2 top-full z-30 mt-1 max-h-[70dvh] overflow-y-auto">
        {STEPS.map((s, i) => {
          const state = stepState(cv, s.id);
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-current={i === index ? "step" : undefined}
                onClick={() => {
                  ref.current?.removeAttribute("open");
                  onGo(i);
                }}
                className={`cvb-menu-item w-full ${i === index ? "bg-brand-soft" : ""}`}
              >
                <span className={state.done ? "text-success" : i === index ? "text-brand-ink" : "text-ink-3"}>
                  <Icon name={state.done ? "check" : STEP_ICON_NAMES[s.id]} size={16} />
                </span>
                <span className="cvb-menu-text font-semibold">{s.short}</span>
                <span className="cvb-caption">{state.meta}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </details>
  );
}

function Tips({ tips }: { tips: string[] }) {
  const t = useT();
  return (
    <details open className="cvb-card group [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 rounded-lg px-4 py-3 text-sm font-semibold text-ink focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none">
        <span className="grid size-7 place-items-center rounded-md bg-info-soft text-info">
          <Icon name="lightbulb" size={16} />
        </span>
        {t("wizard.tips")}
        <Icon name="chevron-down" size={18} className="ms-auto text-ink-3 transition group-open:rotate-180" />
      </summary>
      <ul className="flex list-disc flex-col gap-2 px-4 pb-4 ps-[58px] text-sm leading-relaxed text-ink-2 marker:text-line-strong">
        {tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    </details>
  );
}
