"use client";

import { isActionLed, isQuantified } from "@cvb/domain";
import { useState } from "react";
import { gateForError, useAiAssist, useAiCall } from "@/lib/ai";
import { Dialog } from "../ui/Dialog";
import { btn } from "../ui/styles";
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
                  className="flex w-full items-start gap-3 rounded-xl border border-stone-200 bg-white p-3 text-left text-sm text-stone-800 hover:border-violet-300"
                >
                  <span className="flex-1">{l.text}</span>
                  {!isQuantified(l.text) && <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">no number</span>}
                  {!isActionLed(l.text) && <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">weak start</span>}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-600">
              <span className="font-medium text-stone-800">Original:</span> {bullets[index]}
            </p>
            {!isQuantified(bullets[index] ?? "") && (
              <p className="text-xs text-amber-800">Tip: add a real number if you have one (how many users, how much faster, how much saved). The highlighted parts are for you to fill in.</p>
            )}
            {busy && <p className="py-6 text-center text-sm text-stone-500">Writing suggestions…</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
            {options.map((o) => (
              <Suggestion key={o} text={o} onUse={() => use(o)} />
            ))}
            <div className="flex justify-between pt-1">
              <button type="button" className={btn.ghost} onClick={() => setIndex(null)}>
                ← Another line
              </button>
              <button type="button" className={btn.secondary} disabled={busy} onClick={() => void improve(index)}>
                Try again
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
