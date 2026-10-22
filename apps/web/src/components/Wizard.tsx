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
  ArrowLeftIcon,
  ArrowRightIcon,
  BriefcaseIcon,
  BulbIcon,
  CapIcon,
  CheckIcon,
  ChevronDownIcon,
  DownloadIcon,
  FolderIcon,
  GlobeIcon,
  SparkIcon,
  TextIcon,
  UserIcon,
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
  const Icon = STEP_ICONS[current.id];

  return (
    <div className="@container flex h-full min-h-0 bg-white">
      <StepRail cv={cv} index={index} onGo={goTo} strength={strength} />

      <div className="flex min-w-0 flex-1 flex-col bg-stone-50/70">
        <CompactStepper cv={cv} index={index} onGo={goTo} strength={strength} />

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-2xl flex-col gap-6 px-5 pb-10 pt-7 @min-[560px]:px-8 @min-[560px]:pt-9">
            <header className="flex items-start gap-4">
              <span className="hidden size-11 shrink-0 place-items-center rounded-xl bg-white text-brand shadow-xs ring-1 ring-stone-200 @min-[560px]:grid">
                <Icon className="size-5" />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-xs font-medium text-stone-500">
                  {t("wizard.stepOf", { n: index + 1, total: STEPS.length })}
                  {current.optional && <span className="ms-2 rounded-full bg-stone-200/70 px-2 py-0.5 text-[11px] text-stone-600">{t("common.optional")}</span>}
                </p>
                <h2 className="text-[22px] font-semibold leading-tight tracking-tight text-stone-900">{current.title}</h2>
                <p className="text-sm leading-relaxed text-stone-600">{current.intro}</p>
              </div>
            </header>

            {showErrors && hasErrors && (
              <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                {t("wizard.fixFields")}
              </div>
            )}

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

        <footer className="flex items-center gap-2 border-t border-stone-200 bg-white px-4 py-3 @min-[560px]:px-6">
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 disabled:invisible"
          >
            <ArrowLeftIcon className="size-4 rtl:-scale-x-100" /> {t("common.back")}
          </button>
          <div className="ms-auto flex items-center gap-1.5">
            {next && skip && (
              <button
                type="button"
                onClick={() => goTo(index + 1)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
              >
                {t("common.skip")}
              </button>
            )}
            {next ? (
              <button
                type="button"
                onClick={() => goTo(index + 1)}
                className="group flex items-center gap-2 rounded-lg bg-brand py-2.5 ps-4 pe-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark"
              >
                {t("wizard.continueTo", { step: next.short })}
                <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => actions.exportAs("pdf")}
                disabled={actions.busy === "pdf"}
                className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark"
              >
                <DownloadIcon className="size-4" /> {actions.busy === "pdf" ? t("wizard.preparingPdf") : t("wizard.downloadPdf")}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

type NavProps = { cv: CV; index: number; onGo: (i: number) => void; strength: number };

/** Circular progress showing how much of the CV check passes. */
function Ring({ value, size = 40 }: { value: number; size?: number }) {
  const r = (size - 5) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="4" className="stroke-stone-200" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value)}
        className={`transition-[stroke-dashoffset] duration-500 ${value >= 1 ? "stroke-emerald-500" : "stroke-brand"}`}
      />
    </svg>
  );
}

function StepRail({ cv, index, onGo, strength }: NavProps) {
  const STEPS = useSteps();
  const t = useT();
  const pct = Math.round(strength * 100);
  return (
    <nav
      aria-label={t("wizard.steps")}
      className="hidden w-[68px] shrink-0 flex-col border-e border-stone-200 bg-white @min-[440px]:flex @min-[640px]:w-[232px]"
    >
      <div className="flex items-center justify-center gap-3 border-b border-stone-100 px-3 py-4 @min-[640px]:justify-start @min-[640px]:px-5">
        <div className="relative grid place-items-center" title={`${t("wizard.strength")} ${pct}%`}>
          <Ring value={strength} />
          <span className="absolute text-[10px] font-semibold tabular-nums text-stone-700">{pct}</span>
        </div>
        <div className="hidden min-w-0 @min-[640px]:block">
          <div className="text-sm font-semibold text-stone-900">{t("wizard.strength")}</div>
          <div className="text-xs text-stone-500">
            {pct === 100 ? t("wizard.ready") : pct >= 60 ? t("wizard.almost") : t("wizard.keepGoing")}
          </div>
        </div>
      </div>

      <ol className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3 @min-[640px]:px-3">
        {STEPS.map((s, i) => {
          const state = stepState(cv, s.id);
          const active = i === index;
          const Icon = STEP_ICONS[s.id];
          const last = i === STEPS.length - 1;
          return (
            <li key={s.id} className="relative">
              {!last && (
                <span
                  aria-hidden="true"
                  className={`absolute left-1/2 top-[38px] h-[calc(100%-28px)] w-px -translate-x-1/2 @min-[640px]:start-[25px] @min-[640px]:translate-x-0 ${
                    state.done ? "bg-emerald-300" : "bg-stone-200"
                  }`}
                />
              )}
              <button
                type="button"
                onClick={() => onGo(i)}
                aria-current={active ? "step" : undefined}
                title={`${s.short} · ${state.meta}`}
                className={`relative flex w-full items-center justify-center gap-3 rounded-xl p-1.5 text-start transition @min-[640px]:justify-start @min-[640px]:px-2 ${
                  active ? "bg-brand/[0.07]" : "hover:bg-stone-100/80"
                }`}
              >
                <span
                  className={`relative grid size-8 shrink-0 place-items-center rounded-full transition ${
                    active
                      ? "bg-brand text-white shadow-sm shadow-brand/30"
                      : state.done
                        ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200"
                        : "bg-white text-stone-400 ring-1 ring-stone-200"
                  }`}
                >
                  {state.done && !active ? <CheckIcon className="size-4" /> : <Icon className="size-4" />}
                </span>
                <span className="hidden min-w-0 flex-1 @min-[640px]:block">
                  <span className={`block truncate text-sm font-medium ${active ? "text-brand" : "text-stone-800"}`}>{s.short}</span>
                  <span className={`block truncate text-xs ${state.meta.includes("required") ? "text-amber-700" : "text-stone-500"}`}>
                    {state.meta}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Phones: the current step with a segmented bar; tapping it lists every step. */
function CompactStepper({ cv, index, onGo, strength }: NavProps) {
  const ref = useRef<HTMLDetailsElement>(null);
  const STEPS = useSteps();
  const t = useT();
  const current = STEPS[index];
  const Icon = STEP_ICONS[current.id];
  return (
    <details ref={ref} className="relative border-b border-stone-200 bg-white @min-[440px]:hidden [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
        <span className="grid size-8 place-items-center rounded-full bg-brand text-white">
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-stone-900">{current.short}</span>
          <span className="block text-xs text-stone-500">
            {t("wizard.stepOf", { n: index + 1, total: STEPS.length })} · {Math.round(strength * 100)}%
          </span>
        </span>
        <ChevronDownIcon className="size-4 text-stone-400" />
      </summary>
      <div className="flex gap-1 px-4 pb-3" aria-hidden="true">
        {STEPS.map((s, i) => (
          <span
            key={s.id}
            className={`h-1 flex-1 rounded-full ${i === index ? "bg-brand" : stepState(cv, s.id).done ? "bg-emerald-400" : "bg-stone-200"}`}
          />
        ))}
      </div>
      <ol className="absolute inset-x-2 top-full z-30 mt-1 flex flex-col rounded-xl border border-stone-200 bg-white p-1.5 shadow-xl">
        {STEPS.map((s, i) => {
          const state = stepState(cv, s.id);
          const StepIcon = STEP_ICONS[s.id];
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  ref.current?.removeAttribute("open");
                  onGo(i);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-start ${i === index ? "bg-brand/[0.07]" : "hover:bg-stone-50"}`}
              >
                <span className={state.done ? "text-emerald-600" : i === index ? "text-brand" : "text-stone-400"}>
                  {state.done ? <CheckIcon className="size-4" /> : <StepIcon className="size-4" />}
                </span>
                <span className="flex-1 text-sm font-medium text-stone-800">{s.short}</span>
                <span className="text-xs text-stone-500">{state.meta}</span>
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
    <details open className="group rounded-xl border border-stone-200 bg-white [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-3 text-sm font-medium text-stone-800">
        <span className="grid size-6 place-items-center rounded-md bg-amber-50 text-amber-600 ring-1 ring-amber-200/70">
          <BulbIcon className="size-3.5" />
        </span>
        {t("wizard.tips")}
        <ChevronDownIcon className="ms-auto size-4 text-stone-400 transition group-open:rotate-180" />
      </summary>
      <ul className="flex flex-col gap-2 px-4 pb-4 ps-[52px] text-sm leading-relaxed text-stone-600">
        {tips.map((tip) => (
          <li key={tip} className="relative before:absolute before:-start-3.5 before:top-[9px] before:size-1 before:rounded-full before:bg-stone-300">
            {tip}
          </li>
        ))}
      </ul>
    </details>
  );
}
