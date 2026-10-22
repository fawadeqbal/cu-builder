"use client";

import type { CandidateDto, CandidateUploadResultDto, OrgDto, UpdateCandidateDto } from "@cvb/contracts";
import { CANDIDATE_BATCH_MAX } from "@cvb/contracts";
import { CVDocument } from "@cvb/templates";
import { TEMPLATES } from "@cvb/templates/catalog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Drawer,
  EmptyState,
  FileDrop,
  Icon,
  IconButton,
  ProgressBar,
  Select,
  Skeleton,
  TextArea,
  TextField,
  type IconName,
  type Tone,
} from "@cvb/ui";
import { ApiError } from "@/lib/api";
import { api } from "@/lib/api";
import { orgKeys, useCandidates } from "@/lib/orgs";
import { brandOf, candidateCv, candidateTemplate, exportCandidatePdf, exportCandidatesZip } from "./batch-export";

const STATUS: Record<CandidateDto["status"], [string, Tone, IconName]> = {
  queued: ["Waiting", "neutral", "clock"],
  parsing: ["Reading…", "info", "file"],
  ready: ["Ready", "success", "check"],
  failed: ["Failed", "danger", "x-circle"],
};

/** Sends files with upload progress (fetch can't report it). */
function uploadFiles(
  orgId: string,
  files: File[],
  onProgress: (pct: number) => void,
): Promise<CandidateUploadResultDto> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const f of files) form.append("files", f);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/v1/orgs/${orgId}/candidates`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      const body = JSON.parse(xhr.responseText || "null") as
        | (CandidateUploadResultDto & { error?: { code: string; message: string } })
        | null;
      if (xhr.status >= 200 && xhr.status < 300 && body) resolve(body);
      else
        reject(
          new ApiError(
            xhr.status,
            body?.error?.code ?? "HTTP_ERROR",
            body?.error?.message ?? `Upload failed (${xhr.status})`,
          ),
        );
    };
    xhr.onerror = () => reject(new Error("The upload was interrupted. Check your connection."));
    xhr.send(form);
  });
}

/** Agencies: bulk upload, review what the reader wasn't sure of, export in the agency template. */
export function CandidatesTab({ org, canManage }: { org: OrgDto; canManage: boolean }) {
  const qc = useQueryClient();
  const candidates = useCandidates(org.id);
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

  async function upload(files: File[]) {
    if (!files.length) return;
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
    <div className="flex flex-col gap-6">
      {canManage && (
        <Card title="Upload candidate CVs" description="Each one is read and reformatted in your template.">
          <FileDrop
            title="Drop candidate CVs here"
            hint={`Up to ${CANDIDATE_BATCH_MAX} PDF or Word files, 5 MB each.`}
            button="Choose files"
            multiple
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            busy={progress !== null}
            onFiles={(files) => void upload(files)}
          />
          {progress !== null && <ProgressBar value={progress} label="Uploading" valueLabel={`${progress}%`} />}
          {result && (
            <Alert tone={result.rejected.length ? "warning" : "success"}>
              {result.accepted.length} uploaded
              {result.rejected.length > 0 &&
                `, ${result.rejected.length} skipped: ${result.rejected.map((r) => `${r.fileName} (${r.reason.toLowerCase()})`).join(", ")}`}
              .
            </Alert>
          )}
          {error && <Alert tone="danger">{error}</Alert>}
        </Card>
      )}

      {candidates.isLoading ? (
        <Skeleton height={160} shape="block" />
      ) : batches.length === 0 ? (
        <Card>
          <EmptyState icon="briefcase" title="No candidates yet">
            {canManage && (
              <p>Upload CVs above. We read each one and lay it out in your template, ready to send to clients.</p>
            )}
          </EmptyState>
        </Card>
      ) : (
        batches.map(([batchId, rows]) => {
          const ready = rows.filter((r) => r.status === "ready").length;
          const busy = rows.some((r) => r.status === "queued" || r.status === "parsing");
          const flagged = rows.filter((r) => r.lowConfidence.length > 0).length;
          const exportingThis = exporting?.startsWith(batchId);
          const title = `Upload of ${new Date(rows[rows.length - 1]!.createdAt).toLocaleString()}`;
          return (
            <section key={batchId} className="flex flex-col gap-3" aria-label={title}>
              <header className="flex flex-wrap items-center gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <h2 className="cvb-h3 text-ink">{title}</h2>
                  <p className="cvb-caption flex items-center gap-1.5">
                    {busy && <span className="cvb-spinner" aria-hidden="true" />}
                    {rows.length} files · {ready} ready{busy && " · reading the rest…"} · {flagged} need a check
                  </p>
                </div>
                <Button
                  icon="download"
                  loading={Boolean(exportingThis)}
                  disabled={!ready || Boolean(exporting)}
                  onClick={() => void exportBatch(batchId, rows)}
                >
                  {exportingThis ? `Exporting ${exporting!.split(":")[1] ?? ""}` : "Export PDFs (ZIP)"}
                </Button>
              </header>
              <div className="cvb-table-wrap relative">
                <table className="cvb-table min-w-[36rem]">
                  <caption className="cvb-sr">{title}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Candidate</th>
                      <th scope="col">Status</th>
                      <th scope="col">Contacts</th>
                      <th scope="col">
                        <span className="cvb-sr">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => (
                      <CandidateRow
                        key={c.id}
                        org={org}
                        candidate={c}
                        canManage={canManage}
                        onEdit={() => setEditing(c.id)}
                        onChanged={refresh}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}
      {current && (
        <CandidateEditor
          key={current.id}
          org={org}
          candidate={current}
          canManage={canManage}
          onClose={() => setEditing(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

function CandidateRow({
  org,
  candidate: c,
  canManage,
  onEdit,
  onChanged,
}: {
  org: OrgDto;
  candidate: CandidateDto;
  canManage: boolean;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const update = useMutation({
    mutationFn: (patch: UpdateCandidateDto) => api.patch(`/orgs/${org.id}/candidates/${c.id}`, patch),
    onSuccess: onChanged,
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/orgs/${org.id}/candidates/${c.id}`),
    onSuccess: onChanged,
  });
  const [label, tone, icon] = STATUS[c.status];
  return (
    <tr>
      <td className="cvb-table-primary max-w-64">
        <div className="truncate text-ink">{c.name || c.fileName}</div>
        {c.name && <div className="cvb-caption truncate font-normal">{c.fileName}</div>}
        {c.status === "failed" && c.error && <div className="text-xs font-normal text-danger">{c.error}</div>}
      </td>
      <td>
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone={tone} icon={icon}>
            {label}
          </Badge>
          {c.status === "ready" && c.lowConfidence.length > 0 && (
            <button
              type="button"
              onClick={onEdit}
              className="cvb-badge cvb-badge-warning cursor-pointer hover:underline"
            >
              <Icon name="alert-triangle" size={14} />
              {c.lowConfidence.length} to check
            </button>
          )}
        </span>
      </td>
      <td>
        {c.status === "ready" && (
          <Checkbox
            label="Hide contacts"
            className="whitespace-nowrap text-sm"
            checked={c.hideContacts}
            disabled={!canManage}
            onChange={(e) => update.mutate({ hideContacts: e.target.checked })}
          />
        )}
      </td>
      <td>
        <span className="flex items-center justify-end gap-1">
          {c.status === "ready" && (
            <>
              <Button variant="ghost" size="sm" onClick={onEdit}>
                {canManage ? "Review" : "View"}
              </Button>
              <IconButton
                tooltip={false}
                icon="download"
                size="sm"
                label={`Download ${c.name || c.fileName} as PDF`}
                onClick={() => void exportCandidatePdf(c, org)}
              />
            </>
          )}
          {canManage && (
            <IconButton
              tooltip={false}
              icon="trash"
              size="sm"
              label={`Delete ${c.name || c.fileName}`}
              onClick={() => window.confirm("Delete this candidate?") && remove.mutate()}
            />
          )}
        </span>
      </td>
    </tr>
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

function CandidateEditor({
  org,
  candidate,
  canManage,
  onClose,
  onChanged,
}: {
  org: OrgDto;
  candidate: CandidateDto;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [cv, setCv] = useState(() => candidateCv({ ...candidate, hideContacts: false }));
  const [templateId, setTemplateId] = useState(candidate.templateId ?? org.defaultTemplateId ?? "classic");
  const [hide, setHide] = useState(candidate.hideContacts);
  const flagged = new Set(candidate.lowConfidence.map((f) => f.path));
  const save = useMutation({
    mutationFn: (clearFlags: boolean) =>
      api.patch(`/orgs/${org.id}/candidates/${candidate.id}`, { data: cv, templateId, hideContacts: hide, clearFlags }),
    onSuccess: () => {
      onChanged();
      onClose();
    },
  });
  const preview = { ...candidate, data: cv, templateId, hideContacts: hide };

  return (
    <Drawer
      open
      onClose={onClose}
      title={candidate.name || candidate.fileName}
      description="Check the highlighted fields, then save. The preview shows what your client receives."
      footer={
        canManage ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <span className="flex flex-wrap justify-end gap-2">
              <Button disabled={save.isPending} onClick={() => save.mutate(false)}>
                Save
              </Button>
              <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate(true)}>
                Save and mark checked
              </Button>
            </span>
          </>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-5">
        {candidate.lowConfidence.length > 0 && (
          <div data-testid="low-confidence">
            <Alert tone="warning" title="The reader wasn't sure about:">
              <ul className="list-disc ps-5">
                {candidate.lowConfidence.map((f) => (
                  <li key={f.path}>
                    {f.label}: {f.reason.toLowerCase()}
                  </li>
                ))}
              </ul>
            </Alert>
          </div>
        )}
        <fieldset disabled={!canManage} className="grid gap-4 sm:grid-cols-2">
          {PERSONAL.map(([key, title]) => (
            <TextField
              key={key}
              id={`c-${key}`}
              label={title}
              hint={flagged.has(`personal.${key}`) ? <Check /> : undefined}
              value={cv.personal[key]}
              onChange={(e) => setCv({ ...cv, personal: { ...cv.personal, [key]: e.target.value } })}
            />
          ))}
          <TextArea
            id="c-summary"
            label="Summary"
            className="sm:col-span-2"
            rows={3}
            value={cv.summary}
            onChange={(e) => setCv({ ...cv, summary: e.target.value })}
          />
          {cv.experience.map((e, i) => (
            <div key={e.id} className="grid gap-2 rounded-md border border-line p-3 sm:col-span-2">
              <span className="cvb-overline">Job {i + 1}</span>
              {(["role", "company", "date"] as const).map((k) => (
                <TextField
                  key={k}
                  aria-label={`Job ${i + 1} ${k}`}
                  placeholder={k === "date" ? "Dates" : k === "role" ? "Job title" : "Company"}
                  hint={flagged.has(`experience.${i}.${k}`) ? <Check /> : undefined}
                  value={e[k]}
                  onChange={(ev) =>
                    setCv({
                      ...cv,
                      experience: cv.experience.map((x, j) => (j === i ? { ...x, [k]: ev.target.value } : x)),
                    })
                  }
                />
              ))}
            </div>
          ))}
          <Select
            id="c-template"
            label="Template"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            options={TEMPLATES.map((t) => ({ value: t.id, label: t.name }))}
          />
          <Checkbox
            label="Hide contact details from clients"
            className="self-end pb-2"
            checked={hide}
            onChange={(e) => setHide(e.target.checked)}
          />
        </fieldset>
        <div className="rounded-lg border border-line bg-canvas p-3" aria-label="Preview">
          <div dir="ltr" className="relative mx-auto h-[420px] w-[297px] overflow-hidden bg-paper shadow-sm">
            <div className="absolute start-0 top-0 w-[210mm] origin-top-left scale-[0.375]">
              <div className="paper" data-size="a4">
                <CVDocument cv={candidateCv(preview)} template={candidateTemplate(preview, org)} brand={brandOf(org)} />
              </div>
            </div>
          </div>
        </div>
        {save.error && <Alert tone="danger">{save.error.message}</Alert>}
      </div>
    </Drawer>
  );
}

/** Marks a field the reader wasn't sure of, with an icon and a word as well as colour. */
function Check() {
  return (
    <span className="flex items-center gap-1 text-warning">
      <Icon name="alert-triangle" size={14} /> Check this
    </span>
  );
}
