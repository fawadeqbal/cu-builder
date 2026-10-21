"use client";

import type { ReactNode } from "react";
import { VIEW_MODES, type ViewMode } from "@/lib/layout";
import { EditorIcon, PreviewIcon, SplitIcon } from "./icons";

const ICONS: Record<ViewMode, ReactNode> = {
  editor: <EditorIcon className="size-4" />,
  split: <SplitIcon className="size-4" />,
  preview: <PreviewIcon className="size-4" />,
};

type Props = {
  mode: ViewMode;
  onMode: (mode: ViewMode) => void;
  /** Phones have no room for split view, so it is left out there. */
  allowSplit: boolean;
};

/** Segmented control for Edit / Split / Preview, with a thumb that slides to the active option. */
export function ViewSwitcher({ mode, onMode, allowSplit }: Props) {
  const options = VIEW_MODES.filter((m) => allowSplit || m.id !== "split");
  const shown: ViewMode = !allowSplit && mode === "split" ? "editor" : mode;
  const index = Math.max(0, options.findIndex((m) => m.id === shown));

  return (
    <div
      role="radiogroup"
      aria-label="View"
      className="relative grid rounded-lg bg-stone-100 p-0.5 ring-1 ring-inset ring-stone-200/80"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const next = options[(index + (e.key === "ArrowRight" ? 1 : options.length - 1)) % options.length];
        onMode(next.id);
        e.currentTarget.querySelector<HTMLButtonElement>(`[data-mode="${next.id}"]`)?.focus();
      }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0.5 left-0.5 rounded-md bg-white shadow-sm ring-1 ring-stone-900/5 transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
        style={{
          width: `calc((100% - 4px) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((m) => {
        const active = m.id === shown;
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            data-mode={m.id}
            title={`${m.label} (${m.shortcut})`}
            onClick={() => onMode(m.id)}
            className={`relative z-10 flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand sm:px-3 ${
              active ? "text-stone-900" : "text-stone-500 hover:text-stone-800"
            }`}
          >
            {ICONS[m.id]}
            <span className={allowSplit ? "hidden md:inline" : ""}>{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}
