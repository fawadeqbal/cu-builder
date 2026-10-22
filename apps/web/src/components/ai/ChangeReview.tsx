"use client";

import type { CvChange } from "@cvb/domain";
import { Button, Checkbox, Icon, markPlaceholders } from "@cvb/ui";

const show = (v: string | string[] | null): string[] => (v === null ? [] : Array.isArray(v) ? v.filter((s) => s.trim()) : [v]);

/**
 * Suggested CV edits as before/after rows, each with its own checkbox. Used to review AI
 * tailoring and optimising before anything is applied. [Placeholders] in the new text are
 * highlighted so people see what to fill in.
 */
export function ChangeReview({ changes, accepted, onAccepted }: { changes: CvChange[]; accepted: ReadonlySet<string>; onAccepted: (next: Set<string>) => void }) {
  const toggle = (id: string) => {
    const next = new Set(accepted);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onAccepted(next);
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="cvb-caption flex-1">
          <span className="cvb-num">{accepted.size}</span> of <span className="cvb-num">{changes.length}</span> changes selected
        </span>
        <Button variant="link" size="sm" onClick={() => onAccepted(new Set(changes.map((c) => c.id)))}>
          Accept all
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onAccepted(new Set())}>
          Clear
        </Button>
      </div>
      {changes.map((c) => (
        <ChangeRow key={c.id} change={c} on={accepted.has(c.id)} onToggle={() => toggle(c.id)} />
      ))}
    </div>
  );
}

export function ChangeRow({ change, on, onToggle }: { change: CvChange; on: boolean; onToggle: () => void }) {
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
                  <span key={i}>{markPlaceholders(a)}</span>
                ))}
              </span>
            </span>
          </span>
        }
      />
    </div>
  );
}
