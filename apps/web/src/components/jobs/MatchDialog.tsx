"use client";

import type { CoverLetterDto, JobDto, JobMatchDto, ResumeDto, TailorProposalDto } from "@cvb/contracts";
import { addKeyword, matchJob, newId, type CV } from "@cvb/domain";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Icon, Spinner } from "@cvb/ui";
import { gateForError, useAiCall } from "@/lib/ai";
import { api } from "@/lib/api";
import type { Gate } from "@/lib/plans";
import { useJobs } from "@/lib/queries";
import { Dialog } from "../ui/Dialog";
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
              <Button variant="ghost" icon="arrow-left" className="me-auto" onClick={() => (setJob(null), setMatch(null))}>
                Another job
              </Button>
              {cloud ? (
                <>
                  <Button icon="mail" disabled={busy !== null} loading={busy === "letter"} onClick={() => void startLetter()}>
                    {busy === "letter" ? "Opening…" : "Write a cover letter"}
                  </Button>
                  <Button variant="primary" icon="sparkle" disabled={busy !== null} loading={busy === "tailor"} onClick={() => void startTailor()}>
                    {busy === "tailor" ? "Tailoring…" : "Tailor for this job"}
                  </Button>
                </>
              ) : (
                <Button variant="primary" icon="sparkle" onClick={() => onGate({ kind: "account", what: "tailor your CV and save jobs" })}>
                  Tailor for this job
                </Button>
              )}
            </>
          ) : undefined
        }
      >
        {!job ? (
          <div className="flex flex-col gap-5">
            {cloud && jobs.data && jobs.data.length > 0 && !adding && (
              <div className="flex flex-col gap-2">
                <h3 className="cvb-overline">Your saved jobs</h3>
                <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
                  {jobs.data.map((j) => (
                    <li key={j.id}>
                      <button type="button" onClick={() => void run(j)} className="flex w-full items-center gap-2 rounded-md border border-line bg-surface px-3 py-2.5 text-start text-sm transition-colors hover:border-brand hover:bg-brand-soft">
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-medium text-ink">{j.title}</span>
                          {j.company && <span className="text-ink-3"> · {j.company}</span>}
                        </span>
                        <Icon name="chevron-right" size={16} className="shrink-0 text-ink-3" />
                      </button>
                    </li>
                  ))}
                </ul>
                <Button variant="link" icon="plus" className="self-start" onClick={() => setAdding(true)}>
                  Add a new job
                </Button>
              </div>
            )}
            {(!cloud || adding || (jobs.data && jobs.data.length === 0)) && <JobForm local={!cloud} onSaved={(j) => void run(j)} />}
          </div>
        ) : busy === "match" && !match ? (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-ink-3">
            <Spinner /> Checking your match…
          </p>
        ) : match ? (
          <MatchResult match={match} onAdd={addMissing} onUnlock={() => onGate(cloud ? { kind: "feature", feature: "jobMatch" } : { kind: "account", what: "see every keyword" })} />
        ) : null}
        {error && (
          <Alert tone="danger" className="mt-3">
            {error}
          </Alert>
        )}
      </Dialog>
      {tailor && job && (
        <TailorReview open onClose={() => setTailor(null)} base={tailor.base} proposal={tailor.proposal.proposal} notes={tailor.proposal.notes} job={job} />
      )}
    </>
  );
}
