"use client";

import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Button, Icon, IconButton, cx, type IconName } from "@cvb/ui";
import { useT } from "@/lib/i18n";

/*
 * Read-first forms. Every part of a form is shown as a short, read-only summary with an Edit
 * button; only one part is open for editing at a time, so people see a few fields at once
 * instead of a wall of inputs. Changes apply as they type (the preview updates live) and
 * "Done" folds the part back into its summary.
 */

/* ------------------------------------------------------------------ Editing scope */

type Scope = { openId: string | null; open: (id: string) => void; close: (id: string) => void };
const ScopeCtx = createContext<Scope | null>(null);

/** One editing scope per form or step: opening a part closes the one that was open. */
export function EditingScope({ initial = null, children }: { initial?: string | null; children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(initial);
  const scope = useMemo<Scope>(
    () => ({ openId, open: setOpenId, close: (id) => setOpenId((cur) => (cur === id ? null : cur)) }),
    [openId],
  );
  return <ScopeCtx.Provider value={scope}>{children}</ScopeCtx.Provider>;
}

/** The surrounding scope, for opening a part from outside it (after "Add", or to show an error). */
export function useEditingScope(): Scope {
  const scope = useContext(ScopeCtx);
  if (!scope) throw new Error("useEditingScope needs an <EditingScope>");
  return scope;
}

/** Open state for one part; works without a scope too (then each part is independent). */
function useEditing(id: string) {
  const scope = useContext(ScopeCtx);
  const [local, setLocal] = useState(false);
  if (!scope) return { editing: local, edit: () => setLocal(true), done: () => setLocal(false) };
  return { editing: scope.openId === id, edit: () => scope.open(id), done: () => scope.close(id) };
}

/* ------------------------------------------------------------------ Editable card */

export type EditableCardProps = {
  /** Unique within the scope. */
  id: string;
  title: ReactNode;
  /** A plain-text name for button labels ("Edit Frontend Developer"); defaults to the title when it's a string. */
  name?: string;
  subtitle?: ReactNode;
  icon?: IconName;
  /** Small number or marker before the title (position in a list). */
  leading?: ReactNode;
  /** Nothing filled in yet: shows `emptyText` and an "Add" button instead of "Edit". */
  empty?: boolean;
  emptyText?: ReactNode;
  /** Shows a "Needs attention" marker while closed (e.g. a required field is missing). */
  invalid?: boolean;
  /** The read-only summary. */
  view?: ReactNode;
  /** The fields, shown while editing. */
  children: ReactNode;
  /** Shown at the start of the editing footer (e.g. Remove, move up / down). */
  footerStart?: ReactNode;
  /** Called when the card closes, by Done, Escape or another card opening. */
  onClose?: () => void;
  className?: string;
};

export function EditableCard({ id, title, name, subtitle, icon, leading, empty, emptyText, invalid, view, children, footerStart, onClose, className }: EditableCardProps) {
  const t = useT();
  const { editing, edit, done } = useEditing(id);
  const headingId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const was = useRef(editing);
  const returnFocus = useRef(false);
  const label = name ?? (typeof title === "string" ? title : "");
  const hasView = view !== undefined && view !== null && view !== false;
  const hasBody = editing || (empty ? Boolean(emptyText) : hasView);

  // Opening moves focus into the first field; closing returns it to the Edit button. Not on first render.
  useEffect(() => {
    if (was.current === editing) return;
    was.current = editing;
    if (editing) {
      const first = bodyRef.current?.querySelector<HTMLElement>("input:not([type=hidden]):not([disabled]), textarea, select");
      first?.focus({ preventScroll: true });
      bodyRef.current?.closest("section")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } else {
      // Only after Done / Escape; when another card opened, focus belongs to that card.
      if (returnFocus.current) editRef.current?.focus({ preventScroll: true });
      returnFocus.current = false;
      onClose?.();
    }
  }, [editing, onClose]);

  const finish = () => {
    returnFocus.current = true;
    done();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    // Ignore Escape from dialogs opened inside the card (React bubbles portal events here).
    if (e.key === "Escape" && !e.defaultPrevented && bodyRef.current?.contains(e.target as Node)) {
      e.preventDefault();
      finish();
    }
  };

  return (
    <section
      aria-labelledby={headingId}
      data-editing={editing || undefined}
      className={cx("cvb-card @container transition-[border-color,box-shadow]", editing && "border-brand shadow-[0_0_0_1px_var(--brand)]", className)}
    >
      <div className={cx("flex items-start gap-3 py-3 ps-4 pe-3", hasBody && "border-b border-line")}>
        {leading}
        {icon && (
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-surface-2 text-ink-2">
            <Icon name={icon} size={16} />
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col justify-center self-center">
          <h3 id={headingId} className="line-clamp-2 break-words text-sm font-semibold leading-5 text-ink">
            {title}
          </h3>
          {subtitle && <p className="cvb-caption line-clamp-2 break-words">{subtitle}</p>}
        </div>
        {!editing && (
          <div className="flex shrink-0 items-center gap-1">
            {invalid && (
              <span className="me-1 inline-flex items-center gap-1 text-xs font-medium text-danger">
                <Icon name="alert-triangle" size={14} />
                <span className="hidden @min-[420px]:inline">{t("common.needsAttention")}</span>
              </span>
            )}
            <Button
              ref={editRef}
              size="sm"
              variant={empty ? "primary" : "secondary"}
              icon={empty ? "plus" : "edit"}
              aria-label={label ? t("common.editItem", { item: label }) : undefined}
              onClick={edit}
            >
              {empty ? t("common.add") : t("common.edit")}
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <div onKeyDown={onKeyDown}>
          <div ref={bodyRef} className="flex flex-col gap-4 p-5">
            {children}
          </div>
          <div className="flex items-center gap-2 rounded-b-lg border-t border-line bg-surface-2 px-4 py-2.5">
            {footerStart}
            <Button size="sm" variant="primary" icon="check" className="ms-auto" onClick={finish}>
              {t("common.done")}
            </Button>
          </div>
        </div>
      ) : empty ? (
        emptyText && <p className="px-4 py-3 text-sm text-ink-3">{emptyText}</p>
      ) : (
        hasView && <div className="px-4 py-3">{view}</div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ Read-only pieces */

/** Label / value rows for a summary; empty values are left out (or shown as "Not added" with `showEmpty`). */
export function ViewRows({ rows, showEmpty }: { rows: { label: string; value?: ReactNode; icon?: IconName; ltr?: boolean }[]; showEmpty?: boolean }) {
  const t = useT();
  const shown = rows.filter((r) => showEmpty || (typeof r.value === "string" ? r.value.trim() : r.value));
  if (!shown.length) return <p className="text-sm text-ink-3">{t("common.notAdded")}</p>;
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 @min-[520px]:grid-cols-2">
      {shown.map((r) => {
        const filled = typeof r.value === "string" ? r.value.trim() : r.value;
        return (
          <div key={r.label} className="flex min-w-0 items-start gap-2">
            {r.icon && <Icon name={r.icon} size={16} className="mt-0.5 shrink-0 text-ink-3" />}
            <div className="min-w-0">
              <dt className="cvb-caption">{r.label}</dt>
              <dd dir={r.ltr ? "ltr" : undefined} className={cx("break-words text-sm", filled ? "text-ink" : "text-ink-3", r.ltr && "text-start")}>
                {filled ? r.value : t("common.notAdded")}
              </dd>
            </div>
          </div>
        );
      })}
    </dl>
  );
}

/** Lines of a job or project, clipped to `max` with a "+N more" note. */
export function BulletView({ lines, max = 3 }: { lines: string[]; max?: number }) {
  const t = useT();
  const items = lines.map((l) => l.trim()).filter(Boolean);
  if (!items.length) return null;
  const rest = items.length - max;
  return (
    <ul className="flex list-disc flex-col gap-1 ps-5 text-sm leading-relaxed text-ink-2 marker:text-line-strong">
      {items.slice(0, max).map((l, i) => (
        <li key={i}>
          <span className="line-clamp-2">{l}</span>
        </li>
      ))}
      {rest > 0 && <li className="list-none text-xs text-ink-3">{t("common.moreLines", { n: rest })}</li>}
    </ul>
  );
}

/** A comma-separated list as small tags. */
export function TagView({ text, max = 12 }: { text: string; max?: number }) {
  const t = useT();
  const items = text
    .split(/[,;\n·•|]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.slice(0, max).map((s, i) => (
        <span key={i} className="rounded-sm bg-surface-2 px-2 py-0.5 text-xs text-ink-2">
          {s}
        </span>
      ))}
      {items.length > max && <span className="px-1 py-0.5 text-xs text-ink-3">{t("common.moreLines", { n: items.length - max })}</span>}
    </div>
  );
}

/** A paragraph clipped to a few lines. */
export function TextView({ text, lines = 4 }: { text: string; lines?: number }) {
  const t = useT();
  if (!text.trim()) return <p className="text-sm text-ink-3">{t("common.notAdded")}</p>;
  return (
    <p className="whitespace-pre-line text-sm leading-relaxed text-ink-2" style={{ display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
      {text}
    </p>
  );
}

/* ------------------------------------------------------------------ Lists of entries */

export type EntryListProps<T> = {
  /** Prefix for card ids, unique within the scope ("experience"). */
  list: string;
  items: T[];
  getId: (item: T) => string;
  title: (item: T, index: number) => string;
  subtitle?: (item: T) => ReactNode;
  view: (item: T) => ReactNode;
  edit: (item: T, index: number) => ReactNode;
  /** An entry with nothing in it is removed when it closes. */
  isBlank?: (item: T) => boolean;
  invalid?: (item: T) => boolean;
  /** Adds a blank entry and returns its id, which then opens for editing. */
  onAdd?: () => string;
  addLabel: string;
  /** Hide the Add button at this many entries. */
  max?: number;
  onMove?: (index: number, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
  /** Plain name for one entry, used in "Remove …" labels. */
  noun: string;
  /** Shown when there are no entries. */
  empty?: ReactNode;
};

/** A list section: each entry as a read-only card with Edit; Add opens the new entry straight away. */
export function EntryList<T>({ list, items, getId, title, subtitle, view, edit, isBlank, invalid, onAdd, addLabel, max, onMove, onRemove, noun, empty }: EntryListProps<T>) {
  const t = useT();
  const scope = useContext(ScopeCtx);
  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 && empty}
      {items.map((item, i) => {
        const id = getId(item);
        const name = title(item, i);
        const blank = isBlank?.(item) ?? false;
        return (
          <EditableCard
            key={id}
            id={`${list}:${id}`}
            title={name}
            subtitle={subtitle?.(item)}
            invalid={invalid?.(item)}
            leading={<span className="mt-1.5 grid size-6 shrink-0 place-items-center rounded-md bg-surface-2 font-mono text-xs text-ink-3">{i + 1}</span>}
            view={view(item)}
            empty={blank}
            footerStart={
              <>
                <Button size="sm" variant="ghost" icon="trash" className="text-danger hover:!bg-danger-soft" onClick={() => onRemove(id)}>
                  {t("common.removeItem", { item: noun })}
                </Button>
                {onMove && items.length > 1 && (
                  <span className="flex items-center gap-0.5 border-s border-line ps-1">
                    <IconButton icon="chevron-up" size="sm" label={t("common.moveUp")} onClick={() => onMove(i, -1)} disabled={i === 0} />
                    <IconButton icon="chevron-down" size="sm" label={t("common.moveDown")} onClick={() => onMove(i, 1)} disabled={i === items.length - 1} />
                  </span>
                )}
              </>
            }
            onClose={blank ? () => onRemove(id) : undefined}
          >
            {edit(item, i)}
          </EditableCard>
        );
      })}
      {onAdd && (max === undefined || items.length < max) && (
        <AddEntryButton
          onClick={() => {
            const id = onAdd();
            scope?.open(`${list}:${id}`);
          }}
        >
          {addLabel}
        </AddEntryButton>
      )}
    </div>
  );
}

/** The dashed "add another" target under a list. */
export function AddEntryButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-dashed border-line-control px-4 py-2.5 text-sm font-semibold text-ink-2 transition hover:border-brand hover:bg-brand-soft hover:text-ink focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
    >
      <Icon name="plus" size={18} />
      {children}
    </button>
  );
}

/** Moves entry `index` one place up or down. */
export function moveItem<T>(items: T[], index: number, dir: -1 | 1): T[] {
  const target = index + dir;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
