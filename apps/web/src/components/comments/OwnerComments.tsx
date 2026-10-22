"use client";

import type { CommentDto } from "@cvb/contracts";
import { applyAtAnchor } from "@cvb/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Checkbox, Drawer, EmptyState, Icon } from "@cvb/ui";
import { api } from "@/lib/api";
import type { DocumentController } from "@/lib/document";
import { serviceKeys, useComments } from "@/lib/services";
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
    mutationFn: ({ id, resolved }: { id: string; resolved: boolean }) =>
      api.patch<CommentDto>(`/comments/${id}`, { resolved }),
    onSuccess: (c) =>
      qc.setQueryData<CommentDto[]>(serviceKeys.comments(resumeId), (all) => all?.map((x) => (x.id === c.id ? c : x))),
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
      <div
        className="no-print flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-brand-soft px-4 py-2 text-sm text-ink"
        role="status"
      >
        <span className="flex flex-1 items-center gap-2">
          <Icon
            name={openOnes.length ? "message" : "check-circle"}
            size={18}
            className={openOnes.length ? "text-brand-ink" : "text-success"}
          />
          {openOnes.length
            ? `${openOnes.length} review comment${openOnes.length === 1 ? "" : "s"} to look at.`
            : "All review comments are done."}
        </span>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          Show comments
        </Button>
      </div>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Review comments"
        actions={
          <Checkbox
            label="Show done"
            checked={showDone}
            onChange={(e) => setShowDone(e.target.checked)}
            className="self-center text-sm whitespace-nowrap"
          />
        }
      >
        <div className="flex flex-col gap-3">
          {shown.map((c) => (
            <CommentCard
              key={c.id}
              comment={c}
              onApply={() => apply(c)}
              onResolve={(r) => resolve.mutate({ id: c.id, resolved: r })}
            />
          ))}
          {shown.length === 0 && (
            <EmptyState icon="check-circle" title="Nothing open.">
              Turn on Show done to see the comments you finished.
            </EmptyState>
          )}
        </div>
      </Drawer>
    </>
  );
}
