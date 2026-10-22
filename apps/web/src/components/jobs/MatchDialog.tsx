"use client";

import type { CoverLetterDto, JobDto, JobMatchDto, ResumeDto, TailorProposalDto } from "@cvb/contracts";
import { addKeyword, matchJob, newId, type CV } from "@cvb/domain";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { gateForError, useAiCall } from "@/lib/ai";
import { api } from "@/lib/api";
import type { Gate } from "@/lib/plans";
import { useJobs } from "@/lib/queries";
import { Dialog } from "../ui/Dialog";
import { btn } from "../ui/styles";
import { JobForm } from "./JobForm";
import { MatchResult } from "./MatchResult";
import { TailorReview } from "./TailorReview";

/** Guests get the score and a few keywords, computed in the browser. */
function localMatch(cv: CV, job: JobDto): JobMatchDto {
  const m = matchJob(cv, { title: job.title, description: job.description });
  const missing = m.keywords.filter((k) => !k.found).slice(0, 3);
  return { ...m, keywords: missing, missing: missing.map((k) => k.keyword), resumeId: "local", jobId: "local", complete: false };
}

type Props = {
  open: boolean;
  onClose: () => void;
  cv: CV;
  /** Set for CVs in the account: matching, tailoring and letters use the saved copy. */
  resumeId?: string;
  /** Saves pending edits before the server reads the CV. */
  flush: () => Promise<void>;
  onCv: (cv: CV) => void;
  onGate: (gate: Gate) => void;
};

/** "Match to a job": pick or paste a job, see the match, add keywords, tailor, start a letter. */
export function MatchDialog({ open, onClose, cv, resumeId, flush, onCv, onGate }: Props) {
  const router = useRouter();
  const cloud = Boolean(resumeId);
  const jobs = useJobs(open && cloud);
  const { call } = useAiCall();
  const [job, setJob] = useState<JobDto | null>(null);
  const [match, setMatch] = useState<JobMatchDto | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<"match" | "tailor" | "letter" | null>(null);
  const [error, setError] = useState("");
  const [tailor, setTailor] = useState<{ base: ResumeDto; proposal: TailorProposalDto } | null>(null);

  async function run(j: JobDto, current: CV = cv) {
    setJob(j);
    setError("");
    if (!cloud) return setMatch(localMatch(current, j));
    setBusy("match");
    try {
      await flush();
      setMatch(await api.post<JobMatchDto>(`/jobs/${j.id}/match`, { resumeId }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't match");
    } finally {
      setBusy(null);
    }
  }

  function addMissing(keyword: string) {
    const next = addKeyword(cv, keyword, () => newId("skill"));
    onCv(next);
    if (job) void run(job, next);
  }

  async function startTailor() {
    if (!job || !resumeId) return;
    setBusy("tailor");
    setError("");
    try {
      await flush();
      const [base, proposal] = await Promise.all([
        api.get<ResumeDto>(`/resumes/${resumeId}`),
        call<TailorProposalDto>(`/jobs/${job.id}/tailor`, { resumeId }),
      ]);
      setTailor({ base, proposal });
    } catch (e) {
      const gate = gateForError(e);
      if (gate) onGate(gate);
      else setError(e instanceof Error ? e.message : "Couldn't tailor");
    } finally {
      setBusy(null);
    }
  }

  async function startLetter() {
    if (!job || !resumeId) return;
    setBusy("letter");
    try {
      const letter = await api.post<CoverLetterDto>("/cover-letters", { resumeId, jobId: job.id });
      router.push(`/letters/${letter.id}`);
    } catch (e) {
      const gate = gateForError(e);
      if (gate) onGate(gate);
      else setError(e instanceof Error ? e.message : "Couldn't start a letter");
      setBusy(null);
    }
  }

  const close = () => {
    setJob(null);
    setMatch(null);
    setAdding(false);
    onClose();
  };

  return (
    <>
      <Dialog
        open={open && !tailor}
        onClose={close}
        size="lg"
        title={job ? `${job.title}${job.company ? ` · ${job.company}` : ""}` : "Match your CV to a job"}
        description={job ? undefined : "See how well your CV fits a job ad, what's missing, and tailor it in one go."}
        footer={
          job && match ? (
            <>
              <button type="button" className={btn.ghost} onClick={() => (setJob(null), setMatch(null))}>
                ← Another job
              </button>
              {cloud ? (
                <>
                  <button type="button" className={btn.secondary} disabled={busy !== null} onClick={() => void startLetter()}>
                    {busy === "letter" ? "Opening…" : "Write a cover letter"}
                  </button>
                  <button type="button" className={btn.primary} disabled={busy !== null} onClick={() => void startTailor()}>
                    {busy === "tailor" ? "Tailoring…" : "✦ Tailor for this job"}
                  </button>
                </>
              ) : (
                <button type="button" className={btn.primary} onClick={() => onGate({ kind: "account", what: "tailor your CV and save jobs" })}>
                  Tailor for this job
                </button>
              )}
            </>
          ) : undefined
        }
      >
        {!job ? (
          <div className="flex flex-col gap-5">
            {cloud && jobs.data && jobs.data.length > 0 && !adding && (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Your saved jobs</h4>
                <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
                  {jobs.data.map((j) => (
                    <li key={j.id}>
                      <button type="button" onClick={() => void run(j)} className="w-full rounded-xl border border-stone-200 px-3 py-2 text-left text-sm hover:border-brand/50 hover:bg-brand/[0.03]">
                        <span className="font-medium text-stone-900">{j.title}</span>
                        {j.company && <span className="text-stone-500"> · {j.company}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" className="mt-3 text-sm font-semibold text-brand hover:underline" onClick={() => setAdding(true)}>
                  + Add a new job
                </button>
              </div>
            )}
            {(!cloud || adding || (jobs.data && jobs.data.length === 0)) && <JobForm local={!cloud} onSaved={(j) => void run(j)} />}
          </div>
        ) : busy === "match" && !match ? (
          <p className="py-8 text-center text-sm text-stone-500">Checking your match…</p>
        ) : match ? (
          <MatchResult match={match} onAdd={addMissing} onUnlock={() => onGate(cloud ? { kind: "feature", feature: "jobMatch" } : { kind: "account", what: "see every keyword" })} />
        ) : null}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </Dialog>
      {tailor && job && (
        <TailorReview open onClose={() => setTailor(null)} base={tailor.base} proposal={tailor.proposal.proposal} notes={tailor.proposal.notes} job={job} />
      )}
    </>
  );
}
