"use client";

import type { CandidateDto, CandidateUploadResultDto, OrgDto, UpdateCandidateDto } from "@cvb/contracts";
import { CANDIDATE_BATCH_MAX } from "@cvb/contracts";
import { CVDocument } from "@cvb/templates";
import { TEMPLATES } from "@cvb/templates/catalog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { DownloadIcon, TrashIcon, UploadIcon } from "@cvb/ui";
import { ApiError } from "@/lib/api";
import { api } from "@/lib/api";
import { orgKeys, useCandidates } from "@/lib/orgs";
import { Dialog } from "../ui/Dialog";
import { btn, card, field, label } from "../ui/styles";
import { brandOf, candidateCv, candidateTemplate, exportCandidatePdf, exportCandidatesZip } from "./batch-export";

const STATUS: Record<CandidateDto["status"], [string, string]> = {
  queued: ["Waiting", "bg-stone-100 text-stone-600"],
  parsing: ["Reading…", "bg-sky-50 text-sky-700"],
  ready: ["Ready", "bg-emerald-50 text-emerald-700"],
  failed: ["Failed", "bg-red-50 text-red-700"],
};

/** Sends files with upload progress (fetch can't report it). */
function uploadFiles(orgId: string, files: File[], onProgress: (pct: number) => void): Promise<CandidateUploadResultDto> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const f of files) form.append("files", f);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/v1/orgs/${orgId}/candidates`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      const body = JSON.parse(xhr.responseText || "null") as (CandidateUploadResultDto & { error?: { code: string; message: string } }) | null;
      if (xhr.status >= 200 && xhr.status < 300 && body) resolve(body);
      else reject(new ApiError(xhr.status, body?.error?.code ?? "HTTP_ERROR", body?.error?.message ?? `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("The upload was interrupted. Check your connection."));
    xhr.send(form);
  });
}

/** Agencies: bulk upload, review what the reader wasn't sure of, export in the agency template. */
export function CandidatesTab({ org, canManage }: { org: OrgDto; canManage: boolean }) {
  const qc = useQueryClient();
  const candidates = useCandidates(org.id);
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<CandidateUploadResultDto | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: orgKeys.candidates(org.id) });

  const batches = useMemo(() => {
    const map = new Map<string, CandidateDto[]>();
    for (const c of candidates.data ?? []) map.set(c.batchId, [...(map.get(c.batchId) ?? []), c]);
    return [...map.entries()];
  }, [candidates.data]);
  const current = candidates.data?.find((c) => c.id === editing) ?? null;

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    const files = [...list];
    setError("");
    setResult(null);
    if (files.length > CANDIDATE_BATCH_MAX) return setError(`Choose at most ${CANDIDATE_BATCH_MAX} files at a time.`);
    setProgress(0);
    try {
      setResult(await uploadFiles(org.id, files, setProgress));
      void refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  }

  async function exportBatch(id: string, rows: CandidateDto[]) {
    setExporting(id);
    try {
      await exportCandidatesZip(rows, org, (done, total) => setExporting(`${id}:${done}/${total}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {canManage && (
        <section className={`${card} flex flex-col gap-3 p-5`}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-stone-900">Upload candidate CVs</h2>
              <p className="text-sm text-stone-500">Up to {CANDIDATE_BATCH_MAX} PDF or Word files, 5 MB each. Each one is read and reformatted in your template.</p>
            </div>
            <input
              ref={input}
              type="file"
              multiple
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only"
              aria-label="Candidate CV files"
              onChange={(e) => void upload(e.target.files)}
            />
            <button type="button" className={btn.primary} disabled={progress !== null} onClick={() => input.current?.click()}>
              <UploadIcon className="size-4" /> {progress !== null ? `Uploading ${progress}%` : "Choose files"}
            </button>
          </div>
          {progress !== null && (
            <div className="h-1.5 overflow-hidden rounded-full bg-stone-100" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-brand transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
          {result && (
            <p className="text-sm text-stone-700">
              {result.accepted.length} uploaded{result.rejected.length > 0 && `, ${result.rejected.length} skipped: ${result.rejected.map((r) => `${r.fileName} (${r.reason.toLowerCase()})`).join(", ")}`}.
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </section>
      )}

      {candidates.isLoading ? (
        <p className="py-10 text-center text-sm text-stone-500">Loading…</p>
      ) : batches.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 bg-white px-4 py-10 text-center text-sm text-stone-500">No candidates yet.</p>
      ) : (
        batches.map(([batchId, rows]) => {
          const ready = rows.filter((r) => r.status === "ready").length;
          const busy = rows.some((r) => r.status === "queued" || r.status === "parsing");
          const flagged = rows.filter((r) => r.lowConfidence.length > 0).length;
          const exportingThis = exporting?.startsWith(batchId);
          return (
            <section key={batchId} className={`${card} overflow-hidden`} aria-label={`Upload of ${new Date(rows[rows.length - 1]!.createdAt).toLocaleString()}`}>
              <header className="flex flex-wrap items-center gap-3 border-b border-stone-100 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-stone-900">Upload of {new Date(rows[rows.length - 1]!.createdAt).toLocaleString()}</h2>
                  <p className="text-xs text-stone-500">
                    {rows.length} files · {ready} ready{busy && " · reading the rest…"} · {flagged} need a check
                  </p>
                </div>
                <button type="button" className={btn.secondary} disabled={!ready || Boolean(exporting)} onClick={() => void exportBatch(batchId, rows)}>
                  <DownloadIcon className="size-4" /> {exportingThis ? `Exporting ${exporting!.split(":")[1] ?? ""}` : "Export PDFs (ZIP)"}
                </button>
              </header>
              <ul className="divide-y divide-stone-100">
                {rows.map((c) => (
                  <CandidateRow key={c.id} org={org} candidate={c} canManage={canManage} onEdit={() => setEditing(c.id)} onChanged={refresh} />
                ))}
              </ul>
            </section>
          );
        })
      )}
      {current && <CandidateEditor key={current.id} org={org} candidate={current} canManage={canManage} onClose={() => setEditing(null)} onChanged={refresh} />}
    </div>
  );
}

function CandidateRow({ org, candidate: c, canManage, onEdit, onChanged }: { org: OrgDto; candidate: CandidateDto; canManage: boolean; onEdit: () => void; onChanged: () => void }) {
  const update = useMutation({ mutationFn: (patch: UpdateCandidateDto) => api.patch(`/orgs/${org.id}/candidates/${c.id}`, patch), onSuccess: onChanged });
  const remove = useMutation({ mutationFn: () => api.delete(`/orgs/${org.id}/candidates/${c.id}`), onSuccess: onChanged });
  const [label, tone] = STATUS[c.status];
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-stone-900">{c.name || c.fileName}</div>
        <div className="truncate text-xs text-stone-500">
          {c.fileName}
          {c.status === "failed" && c.error && <span className="text-red-600"> · {c.error}</span>}
        </div>
      </div>
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{label}</span>
      {c.status === "ready" && c.lowConfidence.length > 0 && (
        <button type="button" onClick={onEdit} className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
          {c.lowConfidence.length} to check
        </button>
      )}
      {c.status === "ready" && (
        <>
          <label className="flex items-center gap-1.5 text-xs text-stone-600">
            <input type="checkbox" className="size-3.5 accent-brand" checked={c.hideContacts} disabled={!canManage} onChange={(e) => update.mutate({ hideContacts: e.target.checked })} />
            Hide contacts
          </label>
          <button type="button" className={btn.ghost} onClick={onEdit}>
            {canManage ? "Review" : "View"}
          </button>
          <button type="button" className={btn.ghost} aria-label={`Download ${c.name || c.fileName} as PDF`} onClick={() => void exportCandidatePdf(c, org)}>
            <DownloadIcon className="size-4" />
          </button>
        </>
      )}
      {canManage && (
        <button type="button" className={btn.ghost} aria-label={`Delete ${c.name || c.fileName}`} onClick={() => window.confirm("Delete this candidate?") && remove.mutate()}>
          <TrashIcon className="size-4" />
        </button>
      )}
    </li>
  );
}

const PERSONAL = [
  ["name", "Name"],
  ["headline", "Headline"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["location", "Location"],
  ["linkedin", "LinkedIn"],
] as const;

function CandidateEditor({ org, candidate, canManage, onClose, onChanged }: { org: OrgDto; candidate: CandidateDto; canManage: boolean; onClose: () => void; onChanged: () => void }) {
  const [cv, setCv] = useState(() => candidateCv({ ...candidate, hideContacts: false }));
  const [templateId, setTemplateId] = useState(candidate.templateId ?? org.defaultTemplateId ?? "classic");
  const [hide, setHide] = useState(candidate.hideContacts);
  const flagged = new Set(candidate.lowConfidence.map((f) => f.path));
  const save = useMutation({
    mutationFn: (clearFlags: boolean) => api.patch(`/orgs/${org.id}/candidates/${candidate.id}`, { data: cv, templateId, hideContacts: hide, clearFlags }),
    onSuccess: () => {
      onChanged();
      onClose();
    },
  });
  const preview = { ...candidate, data: cv, templateId, hideContacts: hide };

  return (
    <Dialog
      open
      onClose={onClose}
      title={candidate.name || candidate.fileName}
      description="Check the highlighted fields, then save. The preview shows what your client receives."
      size="lg"
      footer={
        canManage ? (
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={btn.ghost} onClick={onClose}>
              Cancel
            </button>
            <button type="button" className={btn.secondary} disabled={save.isPending} onClick={() => save.mutate(false)}>
              Save
            </button>
            <button type="button" className={btn.primary} disabled={save.isPending} onClick={() => save.mutate(true)}>
              Save and mark checked
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        {candidate.lowConfidence.length > 0 && (
          <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200" data-testid="low-confidence">
            <p className="font-semibold">The reader wasn&apos;t sure about:</p>
            <ul className="mt-1 list-disc ps-5">
              {candidate.lowConfidence.map((f) => (
                <li key={f.path}>
                  {f.label}: {f.reason.toLowerCase()}
                </li>
              ))}
            </ul>
          </div>
        )}
        <fieldset disabled={!canManage} className="grid gap-3 sm:grid-cols-2">
          {PERSONAL.map(([key, title]) => (
            <div key={key}>
              <label className={label} htmlFor={`c-${key}`}>
                {title}
              </label>
              <input
                id={`c-${key}`}
                className={`${field} ${flagged.has(`personal.${key}`) ? "ring-amber-400" : ""}`}
                value={cv.personal[key]}
                onChange={(e) => setCv({ ...cv, personal: { ...cv.personal, [key]: e.target.value } })}
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <label className={label} htmlFor="c-summary">
              Summary
            </label>
            <textarea id="c-summary" rows={3} className={field} value={cv.summary} onChange={(e) => setCv({ ...cv, summary: e.target.value })} />
          </div>
          {cv.experience.map((e, i) => (
            <div key={e.id} className="grid gap-2 rounded-xl p-3 ring-1 ring-stone-200 sm:col-span-2 sm:grid-cols-3">
              {(["role", "company", "date"] as const).map((k) => (
                <input
                  key={k}
                  aria-label={`Job ${i + 1} ${k}`}
                  placeholder={k === "date" ? "Dates" : k === "role" ? "Job title" : "Company"}
                  className={`${field} ${flagged.has(`experience.${i}.${k}`) ? "ring-amber-400" : ""}`}
                  value={e[k]}
                  onChange={(ev) => setCv({ ...cv, experience: cv.experience.map((x, j) => (j === i ? { ...x, [k]: ev.target.value } : x)) })}
                />
              ))}
            </div>
          ))}
          <div>
            <label className={label} htmlFor="c-template">
              Template
            </label>
            <select id="c-template" className={field} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm text-stone-700">
            <input type="checkbox" className="size-4 accent-brand" checked={hide} onChange={(e) => setHide(e.target.checked)} /> Hide contact details from clients
          </label>
        </fieldset>
        <div className="overflow-hidden rounded-xl bg-stone-100 p-3 ring-1 ring-stone-200" aria-label="Preview">
          <div className="relative mx-auto h-[420px] w-[297px] overflow-hidden bg-white shadow-sm">
            <div className="absolute left-0 top-0 w-[210mm] origin-top-left scale-[0.375]">
              <div className="paper" data-size="a4">
                <CVDocument cv={candidateCv(preview)} template={candidateTemplate(preview, org)} brand={brandOf(org)} />
              </div>
            </div>
          </div>
        </div>
        {save.error && <p className="text-sm text-red-600">{save.error.message}</p>}
      </div>
    </Dialog>
  );
}
