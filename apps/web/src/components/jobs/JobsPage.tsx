"use client";

import type { CoverLetterDto, JobDto, JobMatchDto, ResumeDto, TailorProposalDto } from "@cvb/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { PlusIcon, TrashIcon } from "@cvb/ui";
import { gateForError, useAiCall } from "@/lib/ai";
import { api } from "@/lib/api";
import type { Gate } from "@/lib/plans";
import { keys, useJobs, useResumes } from "@/lib/queries";
import { AppHeader } from "../AppHeader";
import { RequireAuth } from "../RequireAuth";
import { UpgradeDialog } from "../UpgradeDialog";
import { Dialog } from "../ui/Dialog";
import { btn, card, field } from "../ui/styles";
import { FeedTab } from "./FeedTab";
import { JobForm } from "./JobForm";
import { MatchResult } from "./MatchResult";
import { TailorReview } from "./TailorReview";

export type JobsTab = { id: string; label: string; render: (ctx: { onGate: (g: Gate) => void }) => ReactNode };

const TABS: JobsTab[] = [
  { id: "feed", label: "Find jobs", render: ({ onGate }) => <FeedTab onGate={onGate} /> },
  { id: "saved", label: "Saved jobs", render: ({ onGate }) => <SavedJobs onGate={onGate} /> },
];

/** Jobs: find postings, saved postings, match against a CV, tailor, and start a cover letter. */
export function JobsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [gate, setGate] = useState<Gate | null>(null);
  const tabs = TABS;
  const tab = tabs.find((t) => t.id === params.get("tab")) ?? tabs[0]!;
  return (
    <RequireAuth>
      {() => (
        <div className="min-h-dvh bg-stone-50">
          <AppHeader />
          <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Jobs</h1>
            {tabs.length > 1 && (
              <nav className="mt-4 flex gap-1 overflow-x-auto border-b border-stone-200 text-sm font-medium">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => router.replace(`/jobs?tab=${t.id}`)}
                    className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 ${t.id === tab.id ? "border-brand text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"}`}
                  >
                    {t.label}
                  </button>
                ))}
              </nav>
            )}
            <div className="mt-6">{tab.render({ onGate: setGate })}</div>
          </main>
          <UpgradeDialog gate={gate} onClose={() => setGate(null)} />
        </div>
      )}
    </RequireAuth>
  );
}

function SavedJobs({ onGate }: { onGate: (g: Gate) => void }) {
  const qc = useQueryClient();
  const jobs = useJobs();
  const [adding, setAdding] = useState(false);
  const params = useSearchParams();
  const [selected, setSelected] = useState<string | null>(params.get("job"));
  const list = jobs.data ?? [];
  const job = list.find((j) => j.id === selected) ?? list[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
      <aside className="flex flex-col gap-2">
        <button type="button" className={`${btn.primary} w-full`} onClick={() => setAdding(true)}>
          <PlusIcon className="size-4" /> Add a job
        </button>
        {jobs.isLoading ? (
          <p className="py-6 text-center text-sm text-stone-500">Loading…</p>
        ) : list.length === 0 ? (
          <p className="rounded-xl border border-dashed border-stone-300 bg-white px-4 py-8 text-center text-sm text-stone-500">
            Save the jobs you&apos;re applying for to match your CV, tailor it and write a cover letter.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {list.map((j) => (
              <li key={j.id}>
                <button
                  type="button"
                  onClick={() => setSelected(j.id)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-start text-sm transition ${job?.id === j.id ? "border-brand/40 bg-brand/[0.04]" : "border-stone-200 bg-white hover:border-stone-300"}`}
                >
                  <div className="truncate font-semibold text-stone-900">{j.title}</div>
                  <div className="truncate text-xs text-stone-500">{[j.company, j.location].filter(Boolean).join(" · ") || "No company"}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
      {job ? <JobDetail key={job.id} job={job} onGate={onGate} /> : <div />}
      <Dialog open={adding} onClose={() => setAdding(false)} title="Add a job" size="lg">
        <JobForm
          onSaved={(j) => {
            setAdding(false);
            setSelected(j.id);
            void qc.invalidateQueries({ queryKey: keys.jobs });
          }}
        />
      </Dialog>
    </div>
  );
}

function JobDetail({ job, onGate }: { job: JobDto; onGate: (g: Gate) => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const resumes = useResumes();
  const { call } = useAiCall();
  const [resumeId, setResumeId] = useState("");
  const [match, setMatch] = useState<JobMatchDto | null>(null);
  const [busy, setBusy] = useState<"match" | "tailor" | "letter" | null>(null);
  const [error, setError] = useState("");
  const [tailor, setTailor] = useState<{ base: ResumeDto; proposal: TailorProposalDto } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const chosen = resumeId || resumes.data?.items[0]?.id || "";

  const remove = useMutation({
    mutationFn: () => api.delete(`/jobs/${job.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.jobs }),
  });

  const track = useMutation({
    mutationFn: () => api.post<{ id: string }>("/applications", { jobId: job.id, ...(chosen ? { resumeId: chosen } : {}) }),
    onSuccess: (app) => router.push(`/tracker?app=${app.id}`),
    onError: (e) => {
      const gate = gateForError(e);
      if (gate) onGate(gate.kind === "feature" ? { kind: "feature", feature: "tracker.unlimited" } : gate);
      else setError(e.message);
    },
  });

  async function act(kind: "match" | "tailor" | "letter") {
    if (!chosen) return;
    setBusy(kind);
    setError("");
    try {
      if (kind === "match") setMatch(await api.post<JobMatchDto>(`/jobs/${job.id}/match`, { resumeId: chosen }));
      if (kind === "tailor") {
        const [base, proposal] = await Promise.all([api.get<ResumeDto>(`/resumes/${chosen}`), call<TailorProposalDto>(`/jobs/${job.id}/tailor`, { resumeId: chosen })]);
        setTailor({ base, proposal });
      }
      if (kind === "letter") {
        const letter = await api.post<CoverLetterDto>("/cover-letters", { resumeId: chosen, jobId: job.id });
        router.push(`/letters/${letter.id}`);
      }
    } catch (e) {
      const gate = gateForError(e);
      if (gate) onGate(gate);
      else setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  const description = job.description.trim();
  return (
    <section className={`${card} flex flex-col gap-5 p-5 sm:p-6`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-stone-900">{job.title}</h2>
          <p className="text-sm text-stone-600">{[job.company, job.location].filter(Boolean).join(" · ")}</p>
          {job.url && (
            <a href={job.url} target="_blank" rel="noreferrer noopener" className="text-sm font-medium text-brand hover:underline">
              Open the posting ↗
            </a>
          )}
        </div>
        <button type="button" className={btn.secondary} disabled={track.isPending} onClick={() => track.mutate()}>
          Track application
        </button>
        <button type="button" className={btn.ghost} aria-label="Delete job" onClick={() => window.confirm("Delete this job?") && remove.mutate()}>
          <TrashIcon className="size-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-xl bg-stone-50 p-3 ring-1 ring-stone-200">
        <label className="min-w-48 flex-1 text-xs font-medium text-stone-600">
          CV to use
          <select className={`${field} mt-1`} value={chosen} onChange={(e) => (setResumeId(e.target.value), setMatch(null))}>
            {resumes.data?.items.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={btn.secondary} disabled={!chosen || busy !== null} onClick={() => void act("match")}>
          {busy === "match" ? "Checking…" : "Check match"}
        </button>
        <button type="button" className={btn.secondary} disabled={!chosen || busy !== null} onClick={() => void act("letter")}>
          {busy === "letter" ? "Opening…" : "Cover letter"}
        </button>
        <button type="button" className={btn.primary} disabled={!chosen || busy !== null} onClick={() => void act("tailor")}>
          {busy === "tailor" ? "Tailoring…" : "✦ Tailor CV"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {match && <MatchResult match={match} onUnlock={() => onGate({ kind: "feature", feature: "jobMatch" })} />}

      {description && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Job description</h3>
          <div className={`whitespace-pre-line text-sm leading-relaxed text-stone-700 ${showAll ? "" : "max-h-72 overflow-hidden"}`}>{description}</div>
          {description.length > 900 && (
            <button type="button" className="mt-2 text-sm font-medium text-brand hover:underline" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show less" : "Show all"}
            </button>
          )}
        </div>
      )}
      {tailor && <TailorReview open onClose={() => setTailor(null)} base={tailor.base} proposal={tailor.proposal.proposal} notes={tailor.proposal.notes} job={job} />}
    </section>
  );
}
