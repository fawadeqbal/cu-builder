"use client";

import type { ResumeDto } from "@cvb/contracts";
import { applyChanges, diffCV, type CV, type CvChange } from "@cvb/domain";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Dialog } from "../ui/Dialog";
import { Alert, Button, Checkbox, EmptyState, Icon } from "@cvb/ui";

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
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon="copy" disabled={accepted.size === 0} loading={busy} onClick={() => void create()}>
            {busy ? "Creating…" : `Create tailored copy (${accepted.size})`}
          </Button>
        </>
      }
    >
      {changes.length === 0 ? (
        <EmptyState icon="check-circle" title="No changes suggested">
          Your CV already reads well for this job.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="cvb-caption flex-1">
              <span className="cvb-num">{accepted.size}</span> of <span className="cvb-num">{changes.length}</span> changes selected
            </span>
            <Button variant="link" size="sm" onClick={() => setAccepted(new Set(changes.map((c) => c.id)))}>
              Accept all
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAccepted(new Set())}>
              Clear
            </Button>
          </div>
          {changes.map((c) => (
            <ChangeRow key={c.id} change={c} on={accepted.has(c.id)} onToggle={() => toggle(c.id)} />
          ))}
        </div>
      )}
      {notes.length > 0 && (
        <Alert tone="info" icon="lightbulb" title="Worth adding if true">
          <ul className="list-disc ps-5">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Alert>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
    </Dialog>
  );
}

function ChangeRow({ change, on, onToggle }: { change: CvChange; on: boolean; onToggle: () => void }) {
  const before = show(change.before);
  const after = show(change.after);
  return (
    <div className={`rounded-lg border p-3 transition-colors ${on ? "border-brand bg-brand-soft" : "border-line bg-surface"}`}>
      <Checkbox
        checked={on}
        onChange={onToggle}
        label={<span className="text-sm font-semibold text-ink">{change.label}</span>}
        description={
          <span className={`mt-2 flex flex-col gap-1 text-sm ${on ? "" : "opacity-70"}`}>
            {before.length > 0 && (
              <span className="flex gap-2 rounded-md bg-danger-soft px-2 py-1 text-danger">
                <Icon name="minus" size={16} className="mt-0.5 shrink-0" label="Removed" />
                <span className="flex min-w-0 flex-col line-through decoration-danger">
                  {before.map((b, i) => (
                    <span key={i}>{b}</span>
                  ))}
                </span>
              </span>
            )}
            <span className="flex gap-2 rounded-md bg-success-soft px-2 py-1 text-success">
              <Icon name="plus" size={16} className="mt-0.5 shrink-0" label="Added" />
              <span className="flex min-w-0 flex-col">
                {after.map((a, i) => (
                  <span key={i}>{a}</span>
                ))}
              </span>
            </span>
          </span>
        }
      />
    </div>
  );
}
