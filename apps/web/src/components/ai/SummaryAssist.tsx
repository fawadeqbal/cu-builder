"use client";

import type { CV } from "@cvb/domain";
import { useRef, useState } from "react";
import { gateForError, useAiAssist, useAiCall } from "@/lib/ai";
import { Dialog } from "../ui/Dialog";
import { btn } from "../ui/styles";
import { AiButton, Suggestion } from "./AiButton";

const MODES = [
  ["grammar", "Fix grammar"],
  ["shorter", "Make shorter"],
  ["formal", "More formal"],
  ["confident", "More confident"],
] as const;

/** "✦ Write for me" and "✦ Rewrite" for the summary. */
export function SummaryAssist({ cv, onChange }: { cv: CV; onChange: (summary: string) => void }) {
  const { enabled, onGate, notify } = useAiAssist();
  const { call } = useAiCall();
  const [options, setOptions] = useState<string[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const menu = useRef<HTMLDetailsElement>(null);

  async function run(kind: string, path: string, body: unknown, pick: (r: Record<string, unknown>) => string[]) {
    if (!enabled) return onGate({ kind: "account", what: "use AI writing" });
    menu.current?.removeAttribute("open");
    setBusy(kind);
    setError("");
    try {
      setOptions(pick(await call<Record<string, unknown>>(path, body)));
    } catch (e) {
      const gate = gateForError(e);
      if (gate) onGate(gate);
      else setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  function use(text: string) {
    const before = cv.summary;
    onChange(text);
    notify("Summary updated", () => onChange(before));
    setOptions(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <AiButton busy={busy === "write"} onClick={() => void run("write", "/ai/write-summary", { cv, targetTitle: cv.personal.headline || undefined }, (r) => r.options as string[])}>
        {cv.summary.trim() ? "Write a new one" : "Write it for me"}
      </AiButton>
      {cv.summary.trim() && (
        <details ref={menu} className="relative [&_summary::-webkit-details-marker]:hidden">
          <summary className="list-none">
            <AiButton busy={busy === "rewrite"} onClick={() => menu.current?.toggleAttribute("open")}>
              Rewrite ▾
            </AiButton>
          </summary>
          <div className="absolute left-0 z-20 mt-1 w-44 rounded-xl border border-stone-200 bg-white p-1 shadow-lg">
            {MODES.map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-100"
                onClick={() => void run("rewrite", "/ai/rewrite", { text: cv.summary, mode }, (r) => [r.text as string])}
              >
                {label}
              </button>
            ))}
          </div>
        </details>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
      <Dialog open={options !== null} onClose={() => setOptions(null)} title="Pick a summary" description="Edit it afterwards to sound like you. Highlighted parts are for you to fill in." size="lg">
        <div className="flex flex-col gap-3">
          {options?.map((o) => (
            <Suggestion key={o} text={o} onUse={() => use(o)} />
          ))}
          <button type="button" className={`${btn.ghost} self-start`} onClick={() => setOptions(null)}>
            Keep mine
          </button>
        </div>
      </Dialog>
    </div>
  );
}
