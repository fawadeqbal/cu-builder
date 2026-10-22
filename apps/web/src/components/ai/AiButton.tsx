"use client";

import type { ReactNode } from "react";
import { SparkIcon } from "@cvb/ui";

/** The small "✦" control that opens AI help next to a field. */
export function AiButton({ onClick, children, busy = false, title }: { onClick: () => void; children: ReactNode; busy?: boolean; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={title}
      className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 ring-1 ring-inset ring-violet-200 transition hover:bg-violet-100 disabled:cursor-wait disabled:opacity-70"
    >
      {busy ? <span className="size-3 animate-spin rounded-full border-2 border-violet-300 border-t-violet-700" /> : <SparkIcon className="size-3.5" />}
      {children}
    </button>
  );
}

/** One AI suggestion to pick. */
export function Suggestion({ text, onUse }: { text: string; onUse: () => void }) {
  const parts = text.split(/(\[[^\]]{1,30}\])/g);
  return (
    <button
      type="button"
      onClick={onUse}
      className="group w-full whitespace-pre-line rounded-xl border border-stone-200 bg-white p-3 text-start text-sm leading-relaxed text-stone-800 shadow-xs transition hover:border-violet-300 hover:bg-violet-50/40"
    >
      {parts.map((p, i) =>
        /^\[[^\]]+\]$/.test(p) ? (
          <mark key={i} className="rounded bg-amber-100 px-0.5 text-amber-900" title="Fill this in with your real figure">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
      <span className="mt-1.5 block text-xs font-semibold text-violet-700 opacity-0 transition group-hover:opacity-100">Use this</span>
    </button>
  );
}
