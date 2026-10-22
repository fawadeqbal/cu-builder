"use client";

import { useEffect, useRef, useState } from "react";
import { AiError, chatJson } from "@/lib/ai";
import { clean, normalizeCV } from "@/lib/cv";
import { ACCEPT, extractText, fileKind } from "@/lib/extract";
import { basicParse, tidyImported } from "@/lib/parse";
import { CV_SCHEMA, extractPrompt } from "@/lib/prompts";
import type { CV } from "@/lib/types";
import { useAi } from "./ai/AiProvider";
import { Modal } from "./Modal";

type Phase =
  | { name: "pick" }
  | { name: "reading"; file: string }
  | { name: "read"; file: string; text: string }
  | { name: "extracting"; file: string; text: string }
  | { name: "review"; file: string; cv: CV; method: "ai" | "basic" | "json" }
  | { name: "error"; message: string };

export function ImportDialog({ onClose, onImport }: { onClose: () => void; onImport: (cv: CV) => void }) {
  const ai = useAi();
  const [phase, setPhase] = useState<Phase>({ name: "pick" });
  const [dragging, setDragging] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [received, setReceived] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (phase.name !== "extracting") return;
    const started = Date.now();
    const t = setInterval(() => setSeconds(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [phase.name]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function runAi(file: string, text: string) {
    setSeconds(0);
    setReceived(0);
    setPhase({ name: "extracting", file, text });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { system, prompt } = extractPrompt(text);
      const data = await chatJson<unknown>({
        settings: ai.settings,
        system,
        prompt,
        schema: CV_SCHEMA,
        signal: controller.signal,
        maxTokens: 8000,
        onProgress: setReceived,
      });
      setPhase({ name: "review", file, cv: tidyImported(normalizeCV(data), text), method: "ai" });
    } catch (e) {
      if (e instanceof AiError && e.kind === "aborted") {
        setPhase({ name: "read", file, text });
        return;
      }
      setPhase({ name: "error", message: e instanceof Error ? e.message : "Something went wrong." });
    }
  }

  async function handleFile(file: File) {
    const kind = fileKind(file);
    if (!kind) {
      setPhase({ name: "error", message: "Please choose a PDF, Word (.docx), text or JSON file." });
      return;
    }
    if (kind === "json") {
      try {
        setPhase({ name: "review", file: file.name, cv: normalizeCV(JSON.parse(await file.text())), method: "json" });
      } catch {
        setPhase({ name: "error", message: "That JSON file isn't a CV backup from this app." });
      }
      return;
    }
    setPhase({ name: "reading", file: file.name });
    try {
      const text = await extractText(file);
      if (text.split(/\s+/).length < 30) {
        setPhase({
          name: "error",
          message:
            "We couldn't find much text in this file. If it's a scanned image PDF, export your CV again as a text PDF or Word file.",
        });
        return;
      }
      if (ai.ready) void runAi(file.name, text);
      else setPhase({ name: "read", file: file.name, text });
    } catch {
      setPhase({ name: "error", message: "We couldn't read this file. It may be damaged or password-protected." });
    }
  }

  const words = (t: string) => t.split(/\s+/).filter(Boolean).length;

  return (
    <Modal title="Import your existing CV" onClose={onClose} wide>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />

      {phase.name === "pick" && (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void handleFile(f);
            }}
            className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
              dragging ? "border-brand bg-brand/5" : "border-stone-300 hover:border-brand hover:bg-stone-50"
            }`}
          >
            <svg viewBox="0 0 24 24" className="size-9 text-brand" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-base font-semibold text-stone-900">Drop your CV here or click to choose</span>
            <span className="text-sm text-stone-500">PDF, Word (.docx), text or a backup (.json)</span>
          </button>
          <p className="text-xs leading-relaxed text-stone-500">
            The file is read in your browser and is not uploaded anywhere.{" "}
            {ai.ready ? (
              <>
                Your local AI (<b>{ai.settings.model}</b>) will sort it into the right sections.
              </>
            ) : (
              <>
                With{" "}
                <button type="button" onClick={ai.openSettings} className="font-medium text-brand underline">
                  local AI set up
                </button>
                , every section is filled in automatically. Without it, contact details, summary and skills are imported.
              </>
            )}
          </p>
        </div>
      )}

      {phase.name === "reading" && <Busy title={`Reading ${phase.file}…`} />}

      {phase.name === "extracting" && (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <Spinner />
          <div>
            <div className="font-semibold text-stone-900">Sorting your CV into sections…</div>
            <div className="mt-1 text-sm text-stone-500">
              {ai.settings.model} on your computer · {seconds}s
              {received > 0 ? ` · ${Math.min(99, Math.round((received / Math.max(phase.text.length * 1.3, 1)) * 100))}% written` : " · reading your CV"}
            </div>
            {seconds > 30 && (
              <div className="mt-1 text-xs text-stone-400">Local models can take a few minutes on a laptop without a GPU.</div>
            )}
          </div>
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-stone-600 ring-1 ring-stone-300 hover:bg-stone-50"
          >
            Cancel
          </button>
        </div>
      )}

      {phase.name === "read" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-stone-50 px-4 py-3 text-sm text-stone-700 ring-1 ring-stone-200">
            Read <b>{words(phase.text)} words</b> from {phase.file}.
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => (ai.ready ? void runAi(phase.file, phase.text) : ai.openSettings())}
              className="flex-1 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              {ai.ready ? "Import everything with AI" : "Set up local AI for a full import"}
            </button>
            <button
              type="button"
              onClick={() => setPhase({ name: "review", file: phase.file, cv: basicParse(phase.text), method: "basic" })}
              className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-stone-700 ring-1 ring-stone-300 hover:bg-stone-50"
            >
              Basic import (no AI)
            </button>
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer text-stone-500">Show the text we found</summary>
            <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-md bg-stone-50 p-3 text-xs text-stone-600">{phase.text}</pre>
          </details>
        </div>
      )}

      {phase.name === "review" && <Review phase={phase} onImport={onImport} onBack={() => setPhase({ name: "pick" })} />}

      {phase.name === "error" && (
        <div className="flex flex-col gap-4">
          <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
            {phase.message}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPhase({ name: "pick" })}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              Try another file
            </button>
            <button type="button" onClick={ai.openSettings} className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 ring-1 ring-stone-300">
              AI settings
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Review({
  phase,
  onImport,
  onBack,
}: {
  phase: Extract<Phase, { name: "review" }>;
  onImport: (cv: CV) => void;
  onBack: () => void;
}) {
  const { cv, method } = phase;
  const rows: [string, string | number][] = [
    ["Name", cv.personal.name || "—"],
    ["Job title", cv.personal.headline || "—"],
    ["Email", cv.personal.email || "—"],
    ["Summary", cv.summary ? `${cv.summary.split(/\s+/).length} words` : "—"],
    ["Jobs", cv.experience.length],
    ["Education", cv.education.length],
    ["Skill groups", cv.skills.length],
    ["Projects", cv.projects.length],
    ["Certificates", cv.certificates.length],
    ["Languages", cv.languages.length],
  ];
  const bullets = cv.experience.reduce((n, e) => n + clean(e.bullets).length, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-stone-600">
        {method === "ai" && "Here's what your local AI found."}
        {method === "basic" && "Basic import found the details below. You can add the rest in the next steps."}
        {method === "json" && "Backup file loaded."}
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg bg-stone-50 px-4 py-3 text-sm ring-1 ring-stone-200 sm:grid-cols-[auto_1fr_auto_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-stone-500">{k}</dt>
            <dd className="truncate font-medium text-stone-900">{v}</dd>
          </div>
        ))}
      </dl>
      {method === "ai" && bullets > 0 && (
        <p className="text-xs text-stone-500">{bullets} achievement lines across your jobs.</p>
      )}
      <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
        This will replace what&rsquo;s in the builder now. Check each step afterwards{method === "ai" ? ": AI can make mistakes" : ""}.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onImport(cv)}
          className="flex-1 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          Use this CV
        </button>
        <button type="button" onClick={onBack} className="rounded-lg px-4 py-2.5 text-sm font-medium text-stone-600 ring-1 ring-stone-300">
          Choose another file
        </button>
      </div>
    </div>
  );
}

function Spinner() {
  return <span className="size-8 animate-spin rounded-full border-[3px] border-stone-200 border-t-brand" aria-hidden="true" />;
}

function Busy({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-sm text-stone-600">
      <Spinner />
      {title}
    </div>
  );
}
