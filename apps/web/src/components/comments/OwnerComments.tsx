"use client";

import type { CommentDto } from "@cvb/contracts";
import { applyAtAnchor } from "@cvb/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CloseIcon } from "@cvb/ui";
import { api } from "@/lib/api";
import type { DocumentController } from "@/lib/document";
import { serviceKeys, useComments } from "@/lib/services";
import { btn } from "../ui/styles";
import { CommentCard } from "./CommentCard";

/**
 * Review comments in the editor, for the CV's owner: a bar above the editor when there are any,
 * and a side panel to read them, apply suggested rewrites and mark them done.
 */
export function OwnerComments({ resumeId, doc }: { resumeId: string; doc: DocumentController }) {
  const qc = useQueryClient();
  const comments = useComments(resumeId);
  const [open, setOpen] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const list = comments.data ?? [];
  const openOnes = list.filter((c) => !c.resolvedAt);
  const resolve = useMutation({
    mutationFn: ({ id, resolved }: { id: string; resolved: boolean }) => api.patch<CommentDto>(`/comments/${id}`, { resolved }),
    onSuccess: (c) => qc.setQueryData<CommentDto[]>(serviceKeys.comments(resumeId), (all) => all?.map((x) => (x.id === c.id ? c : x))),
  });
  if (!list.length) return null;

  function apply(c: CommentDto) {
    if (!c.suggestion) return;
    doc.update({ cv: applyAtAnchor(doc.state.cv, c.anchor, c.suggestion) });
    resolve.mutate({ id: c.id, resolved: true });
  }

  const shown = showDone ? list : openOnes;
  return (
    <>
      <div className="no-print flex items-center gap-3 border-b border-violet-200 bg-violet-50 px-4 py-2 text-sm text-violet-900">
        <span className="flex-1">
          {openOnes.length ? `${openOnes.length} review comment${openOnes.length === 1 ? "" : "s"} to look at.` : "All review comments are done."}
        </span>
        <button type="button" className="font-semibold underline-offset-2 hover:underline" onClick={() => setOpen(true)}>
          Show comments
        </button>
      </div>
      {open && (
        <div className="no-print fixed inset-0 z-50 flex justify-end bg-stone-950/20" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <aside role="dialog" aria-modal="true" aria-label="Review comments" className="flex h-full w-full max-w-md flex-col bg-stone-50 shadow-2xl">
            <header className="flex items-center gap-2 border-b border-stone-200 bg-white px-4 py-3">
              <h2 className="flex-1 text-base font-semibold text-stone-900">Review comments</h2>
              <label className="flex items-center gap-1.5 text-xs text-stone-600">
                <input type="checkbox" className="size-3.5 accent-brand" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show done
              </label>
              <button type="button" className={btn.ghost} aria-label="Close" onClick={() => setOpen(false)}>
                <CloseIcon className="size-4" />
              </button>
            </header>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
              {shown.map((c) => (
                <CommentCard key={c.id} comment={c} onApply={() => apply(c)} onResolve={(r) => resolve.mutate({ id: c.id, resolved: r })} />
              ))}
              {shown.length === 0 && <p className="py-8 text-center text-sm text-stone-500">Nothing open.</p>}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
