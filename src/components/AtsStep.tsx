"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AiError, chatJson } from "@/lib/ai";
import { atsChecks, keywordMatch } from "@/lib/ats";
import { TEMPLATES } from "@/lib/cv";
import { TAILOR_SCHEMA, tailorPrompt } from "@/lib/prompts";
import type { CV, TemplateId } from "@/lib/types";
import { Sparkle } from "./ai/AiAssist";
import { useAi } from "./ai/AiProvider";
import { TextArea } from "./fields";

type Props = {
  cv: CV;
  onChange: (cv: CV) => void;
  template: TemplateId;
  onTemplate: (t: TemplateId) => void;
  jobAd: string;
  onJobAd: (v: string) => void;
};

type Tailor = { summary: string; missingKeywords: string[]; tips: string[] };

export function AtsStep({ cv, onChange, template, onTemplate, jobAd, onJobAd }: Props) {
  const ai = useAi();
  const checks = useMemo(() => atsChecks(cv, template), [cv, template]);
  const match = useMemo(() => (jobAd.trim() ? keywordMatch(cv, jobAd) : null), [cv, jobAd]);
  const [tailor, setTailor] = useState<{ state: "idle" | "running" | "done" | "error"; data?: Tailor; error?: string }>({ state: "idle" });
  const [seconds, setSeconds] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const passed = checks.filter((c) => c.status === "ok").length;
  // Skills the AI summary claims that the CV itself doesn't mention.
  const unsupported = useMemo(
    () => (tailor.data?.summary ? keywordMatch({ ...cv, summary: "" }, tailor.data.summary).missing : []),
    [cv, tailor.data],
  );
  const tpl = TEMPLATES.find((t) => t.id === template);

  useEffect(() => {
    if (tailor.state !== "running") return;
    const start = Date.now();
    const t = setInterval(() => setSeconds(Math.round((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [tailor.state]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function runTailor() {
    if (!ai.ready) {
      ai.openSettings();
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setSeconds(0);
    setTailor({ state: "running" });
    try {
      const { system, prompt } = tailorPrompt(cv, jobAd);
      const data = await chatJson<Tailor>({ settings: ai.settings, system, prompt, schema: TAILOR_SCHEMA, signal: controller.signal, temperature: 0.3 });
      setTailor({ state: "done", data });
    } catch (e) {
      if (e instanceof AiError && e.kind === "aborted") setTailor({ state: "idle" });
      else setTailor({ state: "error", error: e instanceof Error ? e.message : "Something went wrong." });
    }
  }

  const scoreColor = !match ? "" : match.score >= 75 ? "text-emerald-600" : match.score >= 50 ? "text-amber-600" : "text-red-600";

  return (
    <div className="flex flex-col gap-7">
      {/* Job ad match */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-stone-800">Match a job advert</h3>
        <TextArea
          label="Paste the job description"
          rows={6}
          value={jobAd}
          placeholder="Paste the full job advert here to see which keywords your CV already covers."
          onChange={onJobAd}
        />

        {match && (
          <div className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4">
            {match.matched.length + match.missing.length === 0 ? (
              <p className="text-sm text-stone-500">
                No known skills or tools found in this advert. You can still use AI tailoring below.
              </p>
            ) : (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium text-stone-700">Keyword match</span>
                  <span className={`text-2xl font-bold ${scoreColor}`}>{match.score}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                  <div
                    className={`h-full rounded-full ${match.score >= 75 ? "bg-emerald-500" : match.score >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${match.score}%` }}
                  />
                </div>
                {match.matched.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-stone-500">In your CV ({match.matched.length})</span>
                    <div className="flex flex-wrap gap-1.5">
                      {match.matched.map((k) => (
                        <span key={k} className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
                          ✓ {k}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {match.missing.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-stone-500">
                      Missing ({match.missing.length}). Add the ones you really have to your skills or experience:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {match.missing.map((k) => (
                        <span key={k} className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200">
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="border-t border-stone-100 pt-3">
              {tailor.state !== "running" && (
                <button
                  type="button"
                  onClick={() => void runTailor()}
                  className="flex items-center gap-1.5 rounded-md bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 ring-1 ring-violet-200 hover:bg-violet-100"
                >
                  <Sparkle />
                  {tailor.state === "done" ? "Tailor again" : "Tailor my CV to this job with AI"}
                  {!ai.ready && <span className="text-xs font-normal text-violet-500">· set up</span>}
                </button>
              )}
              {tailor.state === "running" && (
                <div className="flex items-center gap-3 text-sm text-stone-600">
                  <span className="size-4 animate-spin rounded-full border-2 border-stone-200 border-t-violet-600" aria-hidden="true" />
                  Comparing your CV with the job… {seconds}s
                  <button type="button" onClick={() => abortRef.current?.abort()} className="text-xs font-medium text-stone-500 underline">
                    Cancel
                  </button>
                </div>
              )}
              {tailor.state === "error" && <p className="mt-2 text-xs text-red-600">{tailor.error}</p>}
              {tailor.state === "done" && tailor.data && (
                <div className="mt-3 flex flex-col gap-3 rounded-lg bg-violet-50/60 p-3 ring-1 ring-violet-200">
                  {tailor.data.summary && (
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-semibold text-violet-700">Suggested summary for this job</span>
                      <p className="text-sm leading-relaxed text-stone-800">{tailor.data.summary}</p>
                      {unsupported.length > 0 && (
                        <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 ring-1 ring-amber-200">
                          This mentions <b>{unsupported.join(", ")}</b>, which your CV doesn&rsquo;t show. Remove{" "}
                          {unsupported.length === 1 ? "it" : "them"} after using it if you don&rsquo;t have{" "}
                          {unsupported.length === 1 ? "that skill" : "those skills"}.
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => onChange({ ...cv, summary: tailor.data!.summary })}
                        className="self-start rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
                      >
                        Use this summary
                      </button>
                    </div>
                  )}
                  {tailor.data.missingKeywords.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-semibold text-violet-700">Terms from the advert your CV doesn&rsquo;t show</span>
                      <div className="flex flex-wrap gap-1.5">
                        {tailor.data.missingKeywords.map((k) => (
                          <span key={k} className="rounded-full bg-white px-2.5 py-0.5 text-xs text-stone-700 ring-1 ring-stone-200">
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {tailor.data.tips.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-violet-700">Suggestions</span>
                      <ul className="list-disc pl-4 text-sm text-stone-700">
                        {tailor.data.tips.map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-[11px] text-stone-500">Only add skills and experience you really have.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ATS checklist */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-stone-800">ATS check</h3>
          <span className="text-xs text-stone-500">
            {passed} of {checks.length} passed
          </span>
        </div>
        <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
          {checks.map((c) => (
            <li key={c.label} className="flex gap-3 px-3 py-2.5 text-sm">
              <span
                aria-hidden="true"
                className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                  c.status === "ok" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                }`}
              >
                {c.status === "ok" ? "✓" : "!"}
              </span>
              <span className="flex-1">
                <span className="font-medium text-stone-800">{c.label}</span>
                <span className="block text-xs leading-relaxed text-stone-500">{c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
        {!tpl?.atsFriendly && (
          <button
            type="button"
            onClick={() => onTemplate("ats")}
            className="self-start rounded-md px-3 py-1.5 text-sm font-medium text-brand ring-1 ring-brand/30 hover:bg-brand/5"
          >
            Switch to the ATS template
          </button>
        )}
      </section>
    </div>
  );
}
