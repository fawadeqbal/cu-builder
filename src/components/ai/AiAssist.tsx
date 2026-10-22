"use client";

import { useEffect, useRef, useState } from "react";
import { AiError, chat, toLines } from "@/lib/ai";
import { useAi } from "./AiProvider";

type State =
  | { name: "idle" }
  | { name: "running"; text: string }
  | { name: "done"; text: string }
  | { name: "error"; message: string };

export function Sparkle({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path d="M10 1.5l1.9 4.6 4.6 1.9-4.6 1.9L10 14.5l-1.9-4.6L3.5 8l4.6-1.9L10 1.5zM16 12.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1z" />
    </svg>
  );
}

/**
 * A "write with AI" button. The answer streams into a suggestion box and only replaces
 * the user's text when they press "Use this".
 */
export function AiAssist({
  label,
  build,
  onAccept,
  asList,
}: {
  label: string;
  build: () => { system: string; prompt: string };
  onAccept: (text: string) => void;
  /** Show the suggestion as a bullet list (one item per line). */
  asList?: boolean;
}) {
  const ai = useAi();
  const [state, setState] = useState<State>({ name: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function run() {
    if (!ai.ready) {
      ai.openSettings();
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ name: "running", text: "" });
    try {
      const { system, prompt } = build();
      const text = await chat({
        settings: ai.settings,
        system,
        prompt,
        signal: controller.signal,
        onText: (t) => setState({ name: "running", text: t }),
      });
      setState(text.trim() ? { name: "done", text: text.trim() } : { name: "error", message: "The model returned nothing. Try again." });
    } catch (e) {
      if (e instanceof AiError && e.kind === "aborted") {
        setState({ name: "idle" });
        return;
      }
      setState({ name: "error", message: e instanceof Error ? e.message : "Something went wrong." });
    }
  }

  const text = state.name === "running" || state.name === "done" ? state.text : "";
  const cleaned = text.replace(/^["“]|["”]$/g, "");

  return (
    <div className="flex flex-col gap-2">
      {(state.name === "idle" || state.name === "error") && (
        <button
          type="button"
          onClick={() => void run()}
          className="flex items-center gap-1.5 self-start rounded-md bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 ring-1 ring-violet-200 hover:bg-violet-100"
        >
          <Sparkle />
          {label}
          {!ai.ready && <span className="text-xs font-normal text-violet-500">· set up</span>}
        </button>
      )}

      {state.name === "error" && (
        <p role="alert" className="text-xs text-red-600">
          {state.message}
        </p>
      )}

      {(state.name === "running" || state.name === "done") && (
        <div className="rounded-lg bg-violet-50/60 p-3 ring-1 ring-violet-200" aria-live="polite">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-violet-700">
            <Sparkle className="size-3.5" />
            {state.name === "running" ? "Writing…" : "Suggestion"}
          </div>
          {asList ? (
            <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-stone-800">
              {toLines(cleaned).map((l, i) => (
                <li key={i}>{l}</li>
              ))}
              {state.name === "running" && toLines(cleaned).length === 0 && <li className="list-none text-stone-400">…</li>}
            </ul>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-800">{cleaned || "…"}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {state.name === "running" ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-stone-600 ring-1 ring-stone-300 hover:bg-white"
              >
                Stop
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onAccept(cleaned);
                    setState({ name: "idle" });
                  }}
                  className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
                >
                  Use this
                </button>
                <button
                  type="button"
                  onClick={() => void run()}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-stone-700 ring-1 ring-stone-300 hover:bg-white"
                >
                  Try again
                </button>
                <button
                  type="button"
                  onClick={() => setState({ name: "idle" })}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-stone-500 hover:bg-white"
                >
                  Discard
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
