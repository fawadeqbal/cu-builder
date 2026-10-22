"use client";

import type { ResumeDto } from "@cvb/contracts";
import { applyChanges, diffCV, type CV, type CvChange } from "@cvb/domain";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Dialog } from "../ui/Dialog";
import { btn } from "../ui/styles";

const show = (v: string | string[] | null): string[] => (v === null ? [] : Array.isArray(v) ? v.filter((s) => s.trim()) : [v]);

/**
 * Reviews AI tailoring as a diff. Nothing changes until the person picks changes and creates
 * a copy; the original CV stays as it is.
 */
export function TailorReview({
  open,
  onClose,
  base,
  proposal,
  notes,
  job,
}: {
  open: boolean;
  onClose: () => void;
  base: ResumeDto;
  proposal: CV;
  notes: string[];
  job: { id: string; title: string; company: string };
}) {
  const router = useRouter();
  const changes = useMemo(() => diffCV(base.data, proposal), [base, proposal]);
  const [accepted, setAccepted] = useState<Set<string>>(() => new Set(changes.map((c) => c.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const toggle = (id: string) => setAccepted((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  async function create() {
    setBusy(true);
    setError("");
    try {
      const copy = await api.post<ResumeDto>("/resumes", {
        title: `${base.title} · ${job.company || job.title}`.slice(0, 120),
        templateId: base.templateId,
        accent: base.accent,
        pageSize: base.pageSize,
        style: base.style,
        data: applyChanges(base.data, proposal, changes, accepted),
        baseResumeId: base.id,
        jobId: job.id,
      });
      router.push(`/edit/${copy.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the copy");
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={`Tailor for ${job.title}${job.company ? ` at ${job.company}` : ""}`}
      description="Review each suggested change. Your original CV is not touched; accepted changes go into a new copy linked to this job."
      footer={
        <>
          <button type="button" className={btn.ghost} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={btn.primary} disabled={busy || accepted.size === 0} onClick={() => void create()}>
            {busy ? "Creating…" : `Create tailored copy (${accepted.size})`}
          </button>
        </>
      }
    >
      {changes.length === 0 ? (
        <p className="py-6 text-center text-sm text-stone-500">No changes suggested: your CV already reads well for this job.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex gap-3 text-xs font-medium">
            <button type="button" className="text-brand hover:underline" onClick={() => setAccepted(new Set(changes.map((c) => c.id)))}>
              Accept all
            </button>
            <button type="button" className="text-stone-500 hover:underline" onClick={() => setAccepted(new Set())}>
              Clear
            </button>
          </div>
          {changes.map((c) => (
            <ChangeRow key={c.id} change={c} on={accepted.has(c.id)} onToggle={() => toggle(c.id)} />
          ))}
        </div>
      )}
      {notes.length > 0 && (
        <div className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
          <p className="font-semibold">Worth adding if true</p>
          <ul className="mt-1 list-disc pl-5">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Dialog>
  );
}

function ChangeRow({ change, on, onToggle }: { change: CvChange; on: boolean; onToggle: () => void }) {
  const before = show(change.before);
  const after = show(change.after);
  return (
    <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${on ? "border-brand/40 bg-brand/[0.03]" : "border-stone-200 bg-white opacity-70"}`}>
      <input type="checkbox" checked={on} onChange={onToggle} className="mt-1 size-4 shrink-0 accent-brand" />
      <div className="min-w-0 flex-1 text-sm">
        <div className="mb-1.5 text-xs font-semibold text-stone-600">{change.label}</div>
        {before.length > 0 && (
          <div className="mb-1 rounded-lg bg-red-50 px-2 py-1 text-red-900 line-through decoration-red-300">
            {before.map((b, i) => (
              <div key={i}>{b}</div>
            ))}
          </div>
        )}
        <div className="rounded-lg bg-emerald-50 px-2 py-1 text-emerald-900">
          {after.map((a, i) => (
            <div key={i}>{a}</div>
          ))}
        </div>
      </div>
    </label>
  );
}
