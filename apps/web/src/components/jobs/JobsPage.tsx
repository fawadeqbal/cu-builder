"use client";

import type { CoverLetterDto, JobDto, JobMatchDto, ResumeDto, TailorProposalDto } from "@cvb/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, Button, Card, EmptyState, IconButton, PageHeader, Select, Skeleton, Tabs } from "@cvb/ui";
import { gateForError, useAiCall } from "@/lib/ai";
import { api } from "@/lib/api";
import { track as trackEvent } from "@/lib/analytics";
import type { Gate } from "@/lib/plans";
import { keys, useJobs, useResumes } from "@/lib/queries";
import { AppHeader } from "../AppHeader";
import { RequireAuth } from "../RequireAuth";
import { UpgradeDialog } from "../UpgradeDialog";
import { Dialog } from "../ui/Dialog";
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
  const [gate, setGate] = useState<Gate | null>(null);
  const tabs = TABS;
  const tab = tabs.find((t) => t.id === params.get("tab")) ?? tabs[0]!;
  return (
    <RequireAuth>
      {() => (
        <div className="min-h-dvh bg-canvas">
          <AppHeader />
          <main className="mx-auto flex max-w-(--layout-lg) flex-col gap-6 px-4 pb-20 pt-10 sm:px-6">
            <PageHeader title="Jobs" />
            {tabs.length > 1 && <Tabs label="Jobs" value={tab.id} items={tabs.map((t) => ({ id: t.id, label: t.label, href: `/jobs?tab=${t.id}` }))} className="-mt-2 overflow-x-auto" />}
            <div>{tab.render({ onGate: setGate })}</div>
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
      <aside className="flex min-w-0 flex-col gap-3">
        <Button icon="plus" block onClick={() => setAdding(true)}>
          Add a job
        </Button>
        {jobs.isLoading ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={60} shape="block" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <Card>
            <EmptyState icon="briefcase" title="No saved jobs yet">
              Save the jobs you&apos;re applying for to match your CV, tailor it and write a cover letter.
            </EmptyState>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Saved jobs">
            {list.map((j) => {
              const current = job?.id === j.id;
              return (
                <li key={j.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(j.id)}
                    aria-current={current || undefined}
                    className={`w-full rounded-lg border px-4 py-3 text-start transition-colors ${current ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-line-strong"}`}
                  >
                    <span className="block truncate text-sm font-semibold text-ink">{j.title}</span>
                    <span className="cvb-caption block truncate">{[j.company, j.location].filter(Boolean).join(" · ") || "No company"}</span>
                  </button>
                </li>
              );
            })}
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
  const params = useSearchParams();
  // Links like /jobs?tab=saved&job=…&resume=…&tailor=1 (from the browser extension) pick the CV and start tailoring.
  const linked = params.get("job") === job.id;
  const [resumeId, setResumeId] = useState(linked ? (params.get("resume") ?? "") : "");
  const [match, setMatch] = useState<JobMatchDto | null>(null);
  const [busy, setBusy] = useState<"match" | "tailor" | "letter" | null>(null);
  const [error, setError] = useState("");
  const [tailor, setTailor] = useState<{ base: ResumeDto; proposal: TailorProposalDto } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const chosen = resumeId || resumes.data?.items[0]?.id || "";
  const autoTailor = useRef(linked && params.get("tailor") === "1");

  const remove = useMutation({
    mutationFn: () => api.delete(`/jobs/${job.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.jobs }),
  });

  const track = useMutation({
    mutationFn: () => api.post<{ id: string }>("/applications", { jobId: job.id, ...(chosen ? { resumeId: chosen } : {}) }),
    onSuccess: (app) => {
      trackEvent("application_added", { from: "jobs" });
      router.push(`/tracker?app=${app.id}`);
    },
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
        trackEvent("cover_letter_created", { from: "jobs" });
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

  useEffect(() => {
    if (!autoTailor.current || !resumes.data) return;
    autoTailor.current = false;
    // Drop the flag first, so reloading the page doesn't tailor (and spend credits) again.
    router.replace(`/jobs?tab=saved&job=${encodeURIComponent(job.id)}`, { scroll: false });
    const found = resumes.data.items.some((r) => r.id === chosen);
    void Promise.resolve().then(() => (found ? act("tailor") : (setResumeId(""), setError("That CV isn't in your account any more. Pick a CV and click Tailor CV."))));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the CVs have loaded
  }, [resumes.data]);

  const description = job.description.trim();
  return (
    <section className="cvb-card flex min-w-0 flex-col gap-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-1 basis-60 flex-col gap-1">
          <h2 className="cvb-h2 text-ink">{job.title}</h2>
          {(job.company || job.location) && <p className="text-sm text-ink-2">{[job.company, job.location].filter(Boolean).join(" · ")}</p>}
          {job.url && (
            <Button variant="link" href={job.url} target="_blank" rel="noreferrer noopener" iconEnd="external-link" className="self-start">
              Open the posting
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button icon="kanban" loading={track.isPending} onClick={() => track.mutate()}>
            Track application
          </Button>
          <IconButton icon="trash" label="Delete job" onClick={() => window.confirm("Delete this job?") && remove.mutate()} />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-surface-2 p-3">
        <Select
          label="CV to use"
          className="min-w-48 flex-1"
          value={chosen}
          onChange={(e) => (setResumeId(e.target.value), setMatch(null))}
          options={resumes.data?.items.map((r) => ({ value: r.id, label: r.title })) ?? []}
        />
        <Button icon="target" disabled={!chosen || busy !== null} loading={busy === "match"} onClick={() => void act("match")}>
          {busy === "match" ? "Checking…" : "Check match"}
        </Button>
        <Button icon="mail" disabled={!chosen || busy !== null} loading={busy === "letter"} onClick={() => void act("letter")}>
          {busy === "letter" ? "Opening…" : "Cover letter"}
        </Button>
        <Button variant="primary" icon="sparkle" disabled={!chosen || busy !== null} loading={busy === "tailor"} onClick={() => void act("tailor")}>
          {busy === "tailor" ? "Tailoring…" : "Tailor CV"}
        </Button>
      </div>
      {busy === "tailor" && (
        <p className="cvb-caption" role="status">
          AI is tailoring your CV for this job. You&apos;ll review each change before anything is saved.
        </p>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      {match && <MatchResult match={match} onUnlock={() => onGate({ kind: "feature", feature: "jobMatch" })} />}

      {description && (
        <div className="flex flex-col gap-2">
          <h3 className="cvb-overline">Job description</h3>
          <div className={`whitespace-pre-line break-words text-sm leading-relaxed text-ink-2 ${showAll ? "" : "max-h-72 overflow-hidden"}`}>{description}</div>
          {description.length > 900 && (
            <Button variant="link" className="self-start" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show less" : "Show all"}
            </Button>
          )}
        </div>
      )}
      {tailor && <TailorReview open onClose={() => setTailor(null)} base={tailor.base} proposal={tailor.proposal.proposal} notes={tailor.proposal.notes} job={job} />}
    </section>
  );
}
