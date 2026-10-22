"use client";

import type { CommentDto } from "@cvb/contracts";
import { CheckIcon, TrashIcon } from "@cvb/ui";
import { btn } from "../ui/styles";

/** One review comment: the line it was about, the note, and an optional suggested rewrite. */
export function CommentCard({
  comment: c,
  onApply,
  onResolve,
  onDelete,
}: {
  comment: CommentDto;
  onApply?: () => void;
  onResolve?: (resolved: boolean) => void;
  onDelete?: () => void;
}) {
  const resolved = Boolean(c.resolvedAt);
  return (
    <article className={`rounded-xl p-3 text-sm ring-1 ${resolved ? "bg-stone-50 ring-stone-200 opacity-70" : "bg-white ring-stone-200"}`} aria-label={`Comment by ${c.author.name}`}>
      <div className="flex items-center gap-2 text-xs text-stone-500">
        <span className="font-semibold text-stone-800">{c.author.name}</span>
        <span className="rounded-full bg-stone-100 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide">{c.authorRole}</span>
        {c.outdated && !resolved && <span className="rounded-full bg-amber-50 px-1.5 py-px text-[10px] font-semibold text-amber-800">Line changed</span>}
        <span className="ms-auto">{new Date(c.createdAt).toLocaleDateString()}</span>
      </div>
      {c.quote && <blockquote className="mt-2 border-s-2 border-stone-300 ps-2 text-xs italic text-stone-500">{c.quote.length > 220 ? `${c.quote.slice(0, 220)}…` : c.quote}</blockquote>}
      <p className="mt-2 whitespace-pre-line text-stone-800">{c.body}</p>
      {c.suggestion && (
        <div className="mt-2 rounded-lg bg-emerald-50 px-2.5 py-2 text-emerald-900 ring-1 ring-emerald-200">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Suggested</div>
          {c.suggestion}
        </div>
      )}
      {(onApply || onResolve || onDelete) && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {onApply && c.suggestion && !resolved && (
            <button type="button" className={`${btn.secondary} px-2.5 py-1 text-xs`} onClick={onApply}>
              Use suggestion
            </button>
          )}
          {onResolve && (
            <button type="button" className={`${btn.ghost} px-2 py-1 text-xs`} onClick={() => onResolve(!resolved)}>
              <CheckIcon className="size-3.5" /> {resolved ? "Reopen" : "Done"}
            </button>
          )}
          {onDelete && (
            <button type="button" className={`${btn.ghost} ms-auto px-2 py-1 text-xs`} aria-label="Delete comment" onClick={onDelete}>
              <TrashIcon className="size-3.5" />
            </button>
          )}
        </div>
      )}
    </article>
  );
}
