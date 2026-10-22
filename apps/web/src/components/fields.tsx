"use client";

import type { ReactNode } from "react";
import { Card, Icon, IconButton, TextArea as DsTextArea, TextField as DsTextField } from "@cvb/ui";
import { useT } from "@/lib/i18n";

/** A card that groups related fields under a heading. */
export function Panel({
  title,
  description,
  aside,
  children,
}: {
  title?: string;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card title={title} description={description} actions={aside}>
      <div className="flex flex-col gap-4">{children}</div>
    </Card>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  error,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  error?: string;
  autoFocus?: boolean;
}) {
  return (
    <DsTextField
      label={label}
      type={type}
      value={value}
      placeholder={placeholder}
      autoFocus={autoFocus}
      required={required}
      error={error}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  hint?: string;
}) {
  return (
    <DsTextArea
      label={label}
      hint={hint}
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="[&_textarea]:resize-y"
    />
  );
}

/** A textarea where each line becomes one item of a string list. */
export function LinesField({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <TextArea
      label={label}
      hint="one per line"
      value={value.join("\n")}
      onChange={(v) => onChange(v.split("\n"))}
      placeholder={placeholder}
      rows={rows}
    />
  );
}

/** Wraps each item of a list section with move up / move down / remove controls. */
export function ItemCard({
  title,
  index,
  total,
  onMove,
  onRemove,
  children,
}: {
  title: string;
  index: number;
  total: number;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <section className="cvb-card">
      <div className="flex items-center gap-3 border-b border-line py-2 ps-4 pe-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-surface-2 font-mono text-xs text-ink-3">{index + 1}</span>
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{title}</h3>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton icon="chevron-up" size="sm" label={t("common.moveUp")} onClick={() => onMove(-1)} disabled={index === 0} />
          <IconButton icon="chevron-down" size="sm" label={t("common.moveDown")} onClick={() => onMove(1)} disabled={index === total - 1} />
          <IconButton icon="trash" size="sm" label={t("common.remove")} onClick={onRemove} className="hover:!bg-danger-soft hover:!text-danger" />
        </div>
      </div>
      <div className="flex flex-col gap-4 p-5">{children}</div>
    </section>
  );
}

/** The dashed "add another" target under a list. */
export function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
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
