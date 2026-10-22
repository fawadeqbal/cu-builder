"use client";

import type { JobMatchDto } from "@cvb/contracts";
import { CheckIcon, LockIcon, PlusIcon } from "@cvb/ui";
import { ScoreRing } from "../ats/ScoreRing";

const FIT = {
  under: "You may be under the experience this job asks for; lead with your strongest, most relevant results.",
  match: "Your experience level fits what the job asks for.",
  over: "You may be more senior than this role; say why it interests you.",
  unknown: "",
} as const;

/** Match %, keywords found and missing (required first), and seniority fit. */
export function MatchResult({ match, onAdd, onUnlock }: { match: JobMatchDto; onAdd?: (keyword: string) => void; onUnlock: () => void }) {
  const missing = match.keywords.filter((k) => !k.found).sort((a, b) => Number(b.required) - Number(a.required));
  const found = match.keywords.filter((k) => k.found);
  const years = match.seniority.jobYears !== null ? ` The ad asks for ${match.seniority.jobYears}+ years; your CV shows about ${match.seniority.cvYears}.` : "";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <ScoreRing score={match.score} size={72} label="Match" />
        <div className="text-sm text-stone-700">
          <p className="font-semibold text-stone-900">{match.score >= 75 ? "Strong match" : match.score >= 50 ? "Partial match" : "Weak match"}</p>
          <p className="text-stone-600">
            {match.titleMatch ? "Your title lines up with the role. " : "Consider a headline closer to the job title. "}
            {FIT[match.seniority.fit]}
            {years}
          </p>
        </div>
      </div>
      {missing.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Missing from your CV</h4>
          <div className="flex flex-wrap gap-1.5">
            {missing.map((k) => (
              <span key={k.keyword} className={`inline-flex items-center gap-1 rounded-full py-1 ps-2.5 pe-1 text-xs font-medium ring-1 ring-inset ${k.required ? "bg-red-50 text-red-800 ring-red-200" : "bg-amber-50 text-amber-900 ring-amber-200"}`}>
                {k.keyword}
                {k.required ? <span className="text-[10px] opacity-70">required</span> : <span className="text-[10px] opacity-70">nice to have</span>}
                {onAdd && (
                  <button type="button" onClick={() => onAdd(k.keyword)} className="ms-0.5 grid size-5 place-items-center rounded-full bg-white/80 hover:bg-white" title={`Add ${k.keyword} to your skills (only if you have it)`}>
                    <PlusIcon className="size-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
          {onAdd && <p className="mt-1.5 text-xs text-stone-500">Add a keyword only if you really have that skill; it goes into your skills section.</p>}
        </div>
      )}
      {match.complete && found.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Already in your CV</h4>
          <div className="flex flex-wrap gap-1.5">
            {found.map((k) => (
              <span key={k.keyword} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
                <CheckIcon className="size-3" /> {k.keyword}
              </span>
            ))}
          </div>
        </div>
      )}
      {!match.complete && (
        <button type="button" onClick={onUnlock} className="flex items-center justify-center gap-1.5 rounded-xl bg-stone-900 px-3 py-2 text-sm font-semibold text-white hover:bg-stone-700">
          <LockIcon className="size-4" /> See every keyword and tailor your CV
        </button>
      )}
    </div>
  );
}
