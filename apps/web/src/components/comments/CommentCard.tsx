"use client";

import type { CommentDto } from "@cvb/contracts";
import { Badge, Button, IconButton } from "@cvb/ui";

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
    <article
      className={`cvb-comment text-sm ${resolved ? "bg-surface-2" : ""}`}
      data-resolved={resolved ? "" : undefined}
      aria-label={`Comment by ${c.author.name}`}
    >
      <div className="cvb-comment-head flex-wrap">
        <span className="cvb-comment-author">{c.author.name}</span>
        <Badge>{c.authorRole}</Badge>
        {c.outdated && !resolved && (
          <Badge tone="warning" icon="alert-triangle">
            Line changed
          </Badge>
        )}
        {resolved && (
          <Badge tone="success" icon="check">
            Done
          </Badge>
        )}
        <span className="cvb-comment-time cvb-num">{new Date(c.createdAt).toLocaleDateString()}</span>
      </div>
      {c.quote && (
        <blockquote className="cvb-comment-quote">
          {c.quote.length > 220 ? `${c.quote.slice(0, 220)}…` : c.quote}
        </blockquote>
      )}
      <p className="cvb-comment-body whitespace-pre-line">{c.body}</p>
      {c.suggestion && (
        <div className="cvb-suggestion">
          <span className="cvb-overline text-ink-3">Suggested</span>
          <span className="whitespace-pre-line">{c.suggestion}</span>
        </div>
      )}
      {(onApply || onResolve || onDelete) && (
        <div className="cvb-comment-actions flex-wrap items-center">
          {onApply && c.suggestion && !resolved && (
            <Button size="sm" icon="check" onClick={onApply}>
              Use suggestion
            </Button>
          )}
          {onResolve && (
            <Button
              size="sm"
              variant="ghost"
              icon={resolved ? "undo" : "check-circle"}
              onClick={() => onResolve(!resolved)}
            >
              {resolved ? "Reopen" : "Done"}
            </Button>
          )}
          {onDelete && (
            <span className="ms-auto">
              <IconButton icon="trash" size="sm" label="Delete comment" onClick={onDelete} />
            </span>
          )}
        </div>
      )}
    </article>
  );
}
