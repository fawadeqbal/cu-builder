"use client";

import type { JobMatchDto } from "@cvb/contracts";
import { Button, KeywordList, PlusIcon, ScoreRing } from "@cvb/ui";

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
  const tone = match.score >= 75 ? "success" : match.score >= 50 ? "warning" : "brand";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <ScoreRing value={match.score} tone={tone} label={`Match ${match.score} out of 100`} />
        <div className="min-w-0 text-sm text-ink-2">
          <p className="cvb-h3 text-ink">{match.score >= 75 ? "Strong match" : match.score >= 50 ? "Partial match" : "Weak match"}</p>
          <p className="text-ink-2">
            {match.titleMatch ? "Your title lines up with the role. " : "Consider a headline closer to the job title. "}
            {FIT[match.seniority.fit]}
            {years}
          </p>
        </div>
      </div>
      {missing.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="cvb-overline">Missing from your CV</h3>
          <div className="cvb-keywords">
            {missing.map((k) => (
              <span key={k.keyword} className="cvb-keyword" data-missing="">
                {k.keyword}
                <span className={`font-sans text-[11px] ${k.required ? "text-danger" : "text-ink-3"}`}>{k.required ? "required" : "nice to have"}</span>
                {onAdd && (
                  <button
                    type="button"
                    onClick={() => onAdd(k.keyword)}
                    className="-me-1 grid size-5 place-items-center rounded-full text-ink-2 hover:bg-surface-3 hover:text-ink focus-visible:shadow-(--focus-ring) focus-visible:outline-none"
                    title={`Add ${k.keyword} to your skills (only if you have it)`}
                  >
                    <PlusIcon className="size-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
          {onAdd && <p className="cvb-caption">Add a keyword only if you really have that skill; it goes into your skills section.</p>}
        </div>
      )}
      {match.complete && found.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="cvb-overline">Already in your CV</h3>
          <KeywordList found={found.map((k) => k.keyword)} />
        </div>
      )}
      {!match.complete && (
        <Button variant="highlight" icon="lock" block onClick={onUnlock}>
          See every keyword and tailor your CV
        </Button>
      )}
    </div>
  );
}
