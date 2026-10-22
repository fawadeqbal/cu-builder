"use client";

import type { ResumeDto, ResumeVersionDto } from "@cvb/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { templateMeta, isTemplateId } from "@cvb/templates/catalog";
import { api } from "@/lib/api";
import { keys, useVersions } from "@/lib/queries";
import { Dialog } from "./ui/Dialog";
import { btn } from "./ui/styles";

const REASON: Record<string, string> = {
  manual: "Saved by you",
  download: "Downloaded",
  daily: "Daily snapshot",
  restore: "Before a restore",
};

type Props = {
  resumeId: string;
  open: boolean;
  onClose: () => void;
  /** Called with the CV as restored, so the editor can show it straight away. */
  onRestored: (resume: ResumeDto) => void;
  /** Saves unsaved edits first, so a snapshot or restore never loses typing. */
  beforeChange: () => Promise<void>;
};

/** Restore points for a CV: made on download, once a day while editing, and on request. */
export function HistoryDialog({ resumeId, open, onClose, onRestored, beforeChange }: Props) {
  const qc = useQueryClient();
  const versions = useVersions(resumeId, open);
  const refresh = () => qc.invalidateQueries({ queryKey: keys.versions(resumeId) });

  const snapshot = useMutation({
    mutationFn: async () => {
      await beforeChange();
      return api.post<ResumeVersionDto>(`/resumes/${resumeId}/versions`, { reason: "manual" });
    },
    onSuccess: refresh,
  });

  const restore = useMutation({
    mutationFn: async (versionId: string) => {
      await beforeChange();
      return api.post<ResumeDto>(`/resumes/${resumeId}/versions/${versionId}/restore`);
    },
    onSuccess: (resume) => {
      void refresh();
      onRestored(resume);
      onClose();
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Version history"
      description="Restoring keeps a copy of the current version, so nothing is lost."
      footer={
        <button type="button" className={btn.secondary} disabled={snapshot.isPending} onClick={() => snapshot.mutate()}>
          {snapshot.isPending ? "Saving…" : "Save a version now"}
        </button>
      }
    >
      {versions.isLoading ? (
        <p className="py-6 text-center text-sm text-stone-500">Loading…</p>
      ) : !versions.data?.length ? (
        <p className="py-6 text-center text-sm text-stone-500">
          No versions yet. One is saved each time you download, and once a day while you edit.
        </p>
      ) : (
        <ol className="-mx-2 flex flex-col">
          {versions.data.map((v, i) => (
            <li key={v.id} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-stone-50">
              <span className={`size-2 shrink-0 rounded-full ${i === 0 ? "bg-brand" : "bg-stone-300"}`} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-stone-800">{new Date(v.createdAt).toLocaleString()}</div>
                <div className="text-xs text-stone-500">
                  {REASON[v.reason] ?? v.reason} · {isTemplateId(v.templateId) ? templateMeta(v.templateId).name : v.templateId}
                </div>
              </div>
              <button
                type="button"
                className={btn.ghost}
                disabled={restore.isPending}
                onClick={() => window.confirm("Restore this version? Your current CV is kept in the history.") && restore.mutate(v.id)}
              >
                Restore
              </button>
            </li>
          ))}
        </ol>
      )}
      {(snapshot.error || restore.error) && <p className="mt-3 text-sm text-red-600">{(snapshot.error ?? restore.error)?.message}</p>}
    </Dialog>
  );
}
