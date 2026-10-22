"use client";

import { isActionLed, isQuantified } from "@cvb/domain";
import { useState } from "react";
import { gateForError, useAiAssist, useAiCall } from "@/lib/ai";
import { Alert, Badge, Button, Icon, Spinner } from "@cvb/ui";
import { Dialog } from "../ui/Dialog";
import { AiButton, Suggestion } from "./AiButton";

type Props = { bullets: string[]; role?: string; company?: string; onChange: (bullets: string[]) => void };

/**
 * "✦ Improve a line": pick a line, get three achievement-style rewrites, use one. Lines without
 * a number get a hint, and suggestions keep placeholders like [number] for the person to fill.
 */
export function BulletsAssist({ bullets, role, company, onChange }: Props) {
  const { enabled, onGate, notify } = useAiAssist();
  const { call } = useAiCall();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState<number | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const lines = bullets.map((b, i) => ({ text: b.trim(), i })).filter((l) => l.text);

  async function improve(i: number) {
    setIndex(i);
    setOptions([]);
    setError("");
    setBusy(true);
    try {
      const res = await call<{ options: string[] }>("/ai/improve-bullet", { bullet: bullets[i], role: role || undefined, company: company || undefined });
      setOptions(res.options);
    } catch (e) {
      const gate = gateForError(e);
      if (gate) {
        setOpen(false);
        onGate(gate);
      } else setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function use(text: string) {
    if (index === null) return;
    const before = bullets;
    onChange(bullets.map((b, i) => (i === index ? text : b)));
    notify("Line updated", () => onChange(before));
    setOpen(false);
  }

  if (!lines.length) return null;
  return (
    <>
      <AiButton
        onClick={() => (enabled ? (setOpen(true), setIndex(null), setOptions([])) : onGate({ kind: "account", what: "use AI writing" }))}
        title="Rewrite a line as an achievement"
      >
        Improve a line
      </AiButton>
      <Dialog open={open} onClose={() => setOpen(false)} title="Improve a line" description="Pick a line. You'll get three stronger versions to choose from; nothing changes until you pick one." size="lg">
        {index === null ? (
          <ul className="flex flex-col gap-2">
            {lines.map((l) => (
              <li key={l.i}>
                <button
                  type="button"
                  onClick={() => void improve(l.i)}
                  className="flex w-full flex-wrap items-start gap-2 rounded-md border border-line bg-surface p-3 text-start text-sm text-ink transition hover:border-brand hover:bg-brand-soft focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
                >
                  <span className="min-w-0 flex-1 basis-48">{l.text}</span>
                  {!isQuantified(l.text) && (
                    <Badge tone="warning" icon="alert-triangle" className="shrink-0">
                      no number
                    </Badge>
                  )}
                  {!isActionLed(l.text) && <Badge className="shrink-0">weak start</Badge>}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="rounded-md bg-surface-2 px-3 py-2 text-sm text-ink-2">
              <span className="font-semibold text-ink">Original:</span> {bullets[index]}
            </p>
            {!isQuantified(bullets[index] ?? "") && (
              <p className="flex items-start gap-2 text-xs leading-5 text-ink-2">
                <Icon name="lightbulb" size={16} className="shrink-0 text-info" />
                Tip: add a real number if you have one (how many users, how much faster, how much saved). The highlighted parts are for you to fill in.
              </p>
            )}
            {busy && (
              <p className="flex items-center justify-center gap-2 py-6 text-sm text-ink-3">
                <Spinner /> Writing suggestions…
              </p>
            )}
            {error && <Alert tone="danger">{error}</Alert>}
            {options.length > 0 && (
              <div className="cvb-ai">
                {options.map((o) => (
                  <Suggestion key={o} text={o} onUse={() => use(o)} />
                ))}
              </div>
            )}
            <div className="flex flex-wrap justify-between gap-2 pt-1">
              <Button variant="ghost" icon="arrow-left" onClick={() => setIndex(null)}>
                Another line
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => void improve(index)}>
                Try again
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
