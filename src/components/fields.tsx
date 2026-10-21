"use client";

import { useId, type ReactNode } from "react";

const inputClass =
  "w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-900 shadow-xs " +
  "placeholder:text-stone-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

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
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-stone-600">
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
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-stone-600">
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
    "grid size-7 place-items-center rounded-md text-stone-500 hover:bg-stone-100 hover:text-stone-900 disabled:pointer-events-none disabled:opacity-30";
  return (
    <div className="rounded-md border border-stone-200 bg-stone-50/60">
      <div className="flex items-center justify-between gap-2 border-b border-stone-200 px-3 py-1.5">
        <span className="truncate text-xs font-semibold text-stone-700">{title}</span>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            className={btn}
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label="Move up"
            title="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            aria-label="Move down"
            title="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            className={`${btn} hover:!bg-red-50 hover:!text-red-600`}
            onClick={onRemove}
            aria-label="Remove"
            title="Remove"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-3 p-3">{children}</div>
    </div>
  );
}

export function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-dashed border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 hover:border-brand hover:bg-brand/5 hover:text-brand"
    >
      + {children}
    </button>
  );
}
