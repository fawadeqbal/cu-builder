"use client";

import { useEffect, useRef, useState } from "react";
import { STEPS } from "@/lib/steps";
import type { CV, TemplateId } from "@/lib/types";
import { AtsStep } from "./AtsStep";
import { FinishStep } from "./FinishStep";
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
  onDownload: () => void;
  onExport: () => void;
  jobAd: string;
  onJobAd: (v: string) => void;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function personalErrors(cv: CV): PersonalErrors {
  const p = cv.personal;
  const errors: PersonalErrors = {};
  if (!p.name.trim()) errors.name = "Please enter your name.";
  if (!p.headline.trim()) errors.headline = "Add the job title you are applying for.";
  if (!p.email.trim()) errors.email = "Employers need an email to contact you.";
  else if (!EMAIL.test(p.email.trim())) errors.email = "This email doesn't look right.";
  return errors;
}

/** Whether the list behind an optional step is still empty, so "Skip" makes sense. */
function isEmptyStep(cv: CV, id: string): boolean {
  if (id === "experience") return cv.experience.length === 0;
  if (id === "education") return cv.education.length === 0;
  if (id === "projects") return cv.projects.length === 0;
  if (id === "extras") return cv.languages.length + cv.certificates.length === 0;
  if (id === "ats") return true;
  return false;
}

export function Wizard({ cv, onChange, step, onStep, template, onTemplate, onDownload, onExport, jobAd, onJobAd }: Props) {
  const index = Math.min(Math.max(step, 0), STEPS.length - 1);
  const current = STEPS[index];
  const [showErrors, setShowErrors] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const errors = current.id === "personal" ? personalErrors(cv) : {};
  const hasErrors = Object.keys(errors).length > 0;

  const navRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    // Keep the current step visible in the horizontally scrolling step list.
    const pill = navRef.current?.querySelector<HTMLElement>('[aria-current="step"]');
    const list = navRef.current;
    if (pill && list) list.scrollTo({ left: pill.offsetLeft - list.clientWidth / 2 + pill.offsetWidth / 2, behavior: "smooth" });
  }, [index]);

  function goTo(next: number) {
    setShowErrors(false);
    onStep(Math.min(Math.max(next, 0), STEPS.length - 1));
  }

  function nextStep() {
    if (hasErrors) {
      setShowErrors(true);
      return;
    }
    goTo(index + 1);
  }

  const next = STEPS[index + 1];
  const skip = current.optional && isEmptyStep(cv, current.id);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Progress */}
      <nav aria-label="CV steps" className="border-b border-stone-200 bg-white px-4 pb-3 pt-3 sm:px-6">
        <div className="mb-2.5 flex items-center justify-between text-xs">
          <span className="font-medium text-stone-500">
            Step {index + 1} of {STEPS.length}
          </span>
          <span className="font-medium text-stone-400">{Math.round((index / (STEPS.length - 1)) * 100)}%</span>
        </div>
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-stone-100">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-300"
            style={{ width: `${(index / (STEPS.length - 1)) * 100}%` }}
          />
        </div>
        <ol ref={navRef} className="relative -mx-1 flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          {STEPS.map((s, i) => {
            const state = i === index ? "current" : i < index ? "done" : "todo";
            return (
              <li key={s.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => (i > index && hasErrors ? setShowErrors(true) : goTo(i))}
                  aria-current={state === "current" ? "step" : undefined}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                    state === "current"
                      ? "bg-brand text-white"
                      : state === "done"
                        ? "text-stone-700 hover:bg-stone-100"
                        : "text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                  }`}
                >
                  <span
                    className={`grid size-4 place-items-center rounded-full text-[10px] ${
                      state === "current"
                        ? "bg-white/25"
                        : state === "done"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-stone-100"
                    }`}
                  >
                    {state === "done" ? "✓" : i + 1}
                  </span>
                  {s.short}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Step content */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-stone-50 px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-xl flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-2xl font-bold tracking-tight text-stone-900">
              {current.title}
              {current.optional && <span className="ml-2 align-middle text-xs font-medium text-stone-400">Optional</span>}
            </h2>
            <p className="text-sm leading-relaxed text-stone-600">{current.intro}</p>
          </div>

          {showErrors && hasErrors && (
            <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
              Please fill in the highlighted fields to continue.
            </div>
          )}

          {current.id === "personal" && (
            <PersonalSection cv={cv} onChange={onChange} errors={showErrors ? errors : {}} />
          )}
          {current.id === "summary" && <SummarySection cv={cv} onChange={onChange} />}
          {current.id === "experience" && <ExperienceSection cv={cv} onChange={onChange} />}
          {current.id === "education" && <EducationSection cv={cv} onChange={onChange} />}
          {current.id === "skills" && <SkillsSection cv={cv} onChange={onChange} />}
          {current.id === "projects" && <ProjectsSection cv={cv} onChange={onChange} />}
          {current.id === "extras" && <ExtrasSection cv={cv} onChange={onChange} />}
          {current.id === "ats" && (
            <AtsStep cv={cv} onChange={onChange} template={template} onTemplate={onTemplate} jobAd={jobAd} onJobAd={onJobAd} />
          )}
          {current.id === "finish" && (
            <FinishStep
              cv={cv}
              template={template}
              onTemplate={onTemplate}
              onGoTo={goTo}
              onDownload={onDownload}
              onExport={onExport}
            />
          )}

          {current.tips.length > 0 && (
            <aside className="rounded-lg bg-amber-50/70 px-4 py-3 ring-1 ring-amber-200/70">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800">Tips</div>
              <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-amber-900/80">
                {current.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-2 border-t border-stone-200 bg-white px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-100 disabled:invisible"
        >
          ← Back
        </button>
        <div className="ml-auto flex items-center gap-2">
          {next && skip && (
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-stone-500 hover:bg-stone-100"
            >
              Skip
            </button>
          )}
          {next ? (
            <button
              type="button"
              onClick={nextStep}
              className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-brand-dark"
            >
              Next: {next.short} →
            </button>
          ) : (
            <button
              type="button"
              onClick={onDownload}
              className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-brand-dark"
            >
              Download PDF
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
