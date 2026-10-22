"use client";

import type { ResumeDto } from "@cvb/contracts";
import { applyChanges, diffCV, type CV } from "@cvb/domain";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Dialog } from "../ui/Dialog";
import { Alert, Button, EmptyState } from "@cvb/ui";
import { ChangeReview } from "../ai/ChangeReview";

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
        <ChangeReview changes={changes} accepted={accepted} onAccepted={setAccepted} />
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
