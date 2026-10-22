"use client";

import type { CV } from "@cvb/domain";
import { useState } from "react";
import { Alert, Button, Dropdown } from "@cvb/ui";
import { gateForError, useAiAssist, useAiCall } from "@/lib/ai";
import { Dialog } from "../ui/Dialog";
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

  async function run(kind: string, path: string, body: unknown, pick: (r: Record<string, unknown>) => string[]) {
    if (!enabled) return onGate({ kind: "account", what: "use AI writing" });
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
        <Dropdown
          align="start"
          label="Rewrite"
          trigger={({ toggle, ...aria }) => (
            <Button variant="ghost" size="sm" icon="sparkle" iconEnd="chevron-down" loading={busy === "rewrite"} onClick={toggle} className="[&>.cvb-icon:first-child]:text-brand-ink" {...aria}>
              Rewrite
            </Button>
          )}
          items={MODES.map(([mode, label]) => ({
            label,
            onSelect: () => void run("rewrite", "/ai/rewrite", { text: cv.summary, mode }, (r) => [r.text as string]),
          }))}
        />
      )}
      {error && (
        <Alert tone="danger" className="w-full">
          {error}
        </Alert>
      )}
      <Dialog open={options !== null} onClose={() => setOptions(null)} title="Pick a summary" description="Edit it afterwards to sound like you. Highlighted parts are for you to fill in." size="lg">
        <div className="cvb-ai">
          {options?.map((o) => (
            <Suggestion key={o} text={o} onUse={() => use(o)} />
          ))}
          <Button variant="ghost" className="self-start" onClick={() => setOptions(null)}>
            Keep mine
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
