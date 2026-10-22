"use client";

import type { ReactNode } from "react";
import { Card, TextArea as DsTextArea, TextField as DsTextField } from "@cvb/ui";

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
