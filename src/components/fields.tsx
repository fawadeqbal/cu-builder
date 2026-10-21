"use client";

import { useId, type ReactNode } from "react";
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, TrashIcon } from "./icons";

const inputClass =
  "w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 shadow-xs transition " +
  "placeholder:text-stone-400 hover:border-stone-300 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10";

const labelClass = "text-[13px] font-medium text-stone-700";

/** A white card that groups related fields under a heading. */
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
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
      {(title || aside) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-sm font-semibold text-stone-900">{title}</h3>}
            {description && <p className="mt-0.5 text-xs text-stone-500">{description}</p>}
          </div>
          {aside}
        </div>
      )}
      <div className="flex flex-col gap-4">{children}</div>
    </section>
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
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} ${error ? "!border-red-500 focus:!ring-red-500/20" : ""}`}
      />
      {error && (
        <p id={`${id}-error`} className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
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
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
        {hint && <span className="ml-1.5 font-normal text-stone-400">{hint}</span>}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} resize-y leading-relaxed`}
      />
    </div>
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
  const btn =
    "grid size-8 place-items-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-800 disabled:pointer-events-none disabled:opacity-30";
  return (
    <div className="group/card rounded-2xl border border-stone-200 bg-white shadow-xs transition hover:border-stone-300">
      <div className="flex items-center gap-3 border-b border-stone-100 py-2 pl-4 pr-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-stone-100 text-[11px] font-semibold tabular-nums text-stone-500">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-stone-800">{title}</span>
        <div className="flex shrink-0 items-center opacity-60 transition group-hover/card:opacity-100 group-focus-within/card:opacity-100">
          <button type="button" className={btn} onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move up" title="Move up">
            <ChevronUpIcon className="size-4" />
          </button>
          <button type="button" className={btn} onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Move down" title="Move down">
            <ChevronDownIcon className="size-4" />
          </button>
          <button type="button" className={`${btn} hover:!bg-red-50 hover:!text-red-600`} onClick={onRemove} aria-label="Remove" title="Remove">
            <TrashIcon className="size-4" />
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-4 p-4">{children}</div>
    </div>
  );
}

export function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-300 bg-white/60 px-4 py-3 text-sm font-medium text-stone-600 transition hover:border-brand hover:bg-brand/[0.04] hover:text-brand"
    >
      <span className="grid size-5 place-items-center rounded-full bg-stone-100 text-stone-500 transition group-hover:bg-brand/10 group-hover:text-brand">
        <PlusIcon className="size-3.5" />
      </span>
      {children}
    </button>
  );
}
