"use client";

import type { ResumeDto, ResumeVersionDto } from "@cvb/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { templateMeta, isTemplateId } from "@cvb/templates/catalog";
import { api } from "@/lib/api";
import { keys, useVersions } from "@/lib/queries";
import { Alert, Button, EmptyState, Icon, Skeleton } from "@cvb/ui";
import { Dialog } from "./ui/Dialog";

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
        <Button variant="secondary" icon="clock" loading={snapshot.isPending} onClick={() => snapshot.mutate()}>
          {snapshot.isPending ? "Saving…" : "Save a version now"}
        </Button>
      }
    >
      {versions.isLoading ? (
        <div className="flex flex-col gap-4 py-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton shape="circle" width={32} height={32} />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton width="45%" />
                <Skeleton width="30%" height={10} />
              </div>
            </div>
          ))}
        </div>
      ) : !versions.data?.length ? (
        <EmptyState icon="clock" title="No versions yet" className="py-6">
          One is saved each time you download, and once a day while you edit.
        </EmptyState>
      ) : (
        <ol className="-mx-2 flex flex-col">
          {versions.data.map((v, i) => (
            <li key={v.id} className="flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-surface-2">
              <span className={`grid size-8 shrink-0 place-items-center rounded-full ${i === 0 ? "bg-brand-soft text-brand-ink" : "bg-surface-2 text-ink-3"}`}>
                <Icon name="clock" size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="cvb-num text-sm font-semibold text-ink">{new Date(v.createdAt).toLocaleString()}</div>
                <div className="cvb-caption">
                  {REASON[v.reason] ?? v.reason} · {isTemplateId(v.templateId) ? templateMeta(v.templateId).name : v.templateId}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon="undo"
                disabled={restore.isPending}
                onClick={() => window.confirm("Restore this version? Your current CV is kept in the history.") && restore.mutate(v.id)}
              >
                Restore
              </Button>
            </li>
          ))}
        </ol>
      )}
      {(snapshot.error || restore.error) && (
        <Alert tone="danger" className="mt-3">
          {(snapshot.error ?? restore.error)?.message}
        </Alert>
      )}
    </Dialog>
  );
}
