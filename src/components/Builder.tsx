"use client";

import { useEffect, useRef, useState } from "react";
import { emptyCV, loadSaved, normalizeCV, save, TEMPLATES, type Saved } from "@/lib/cv";
import { sampleCV } from "@/lib/sample";
import type { CV, TemplateId } from "@/lib/types";
import { Editor } from "./Editor";
import { Preview } from "./Preview";

export default function Builder() {
  // Rendered on the client only (see BuilderLoader), so reading localStorage here is safe.
  const [state, setState] = useState<Saved>(() => loadSaved() ?? { cv: sampleCV, template: "classic" });
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    save(state);
  }, [state]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 2500);
    return () => clearTimeout(t);
  }, [notice]);

  const setCV = (cv: CV) => setState((s) => ({ ...s, cv }));
  const setTemplate = (template: TemplateId) => setState((s) => ({ ...s, template }));

  function downloadPdf() {
    const previous = document.title;
    const name = state.cv.personal.name.trim() || "My";
    document.title = `${name} CV`;
    window.print();
    document.title = previous;
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state.cv, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = (state.cv.personal.name.trim() || "cv").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    a.href = url;
    a.download = `${slug}-cv.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file: File) {
    try {
      const cv = normalizeCV(JSON.parse(await file.text()));
      setCV(cv);
      setNotice("CV imported");
    } catch {
      setNotice("That file isn't a valid CV JSON");
    }
  }

  function reset(kind: "sample" | "blank") {
    const message =
      kind === "blank"
        ? "Start from a blank CV? Your current content will be cleared."
        : "Load the example CV? Your current content will be replaced.";
    if (!window.confirm(message)) return;
    setCV(kind === "blank" ? emptyCV : sampleCV);
  }

  const ghost =
    "rounded-md px-2.5 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900";

  return (
    <div className="app flex h-dvh flex-col bg-stone-100">
      <header className="no-print flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-stone-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-md bg-brand text-xs font-bold text-white">CV</span>
          <span className="text-[15px] font-semibold tracking-tight text-stone-900">CV Builder</span>
        </div>

        <div role="radiogroup" aria-label="Template" className="flex rounded-lg bg-stone-100 p-0.5">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={state.template === t.id}
              title={t.description}
              onClick={() => setTemplate(t.id)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                state.template === t.id
                  ? "bg-white text-stone-900 shadow-xs ring-1 ring-stone-200"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1">
          <button type="button" className={ghost} onClick={() => fileRef.current?.click()}>
            Import
          </button>
          <button type="button" className={ghost} onClick={exportJson}>
            Export JSON
          </button>
          <button type="button" className={ghost} onClick={() => reset("sample")}>
            Example
          </button>
          <button type="button" className={ghost} onClick={() => reset("blank")}>
            Clear
          </button>
          <button
            type="button"
            onClick={downloadPdf}
            className="ml-1 rounded-md bg-brand px-3.5 py-1.5 text-sm font-semibold text-white shadow-xs hover:bg-brand-dark"
          >
            Download PDF
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importJson(file);
              e.target.value = "";
            }}
          />
        </div>
      </header>

      <div className="no-print flex border-b border-stone-200 bg-white lg:hidden">
        {(["edit", "preview"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium capitalize ${
              tab === t ? "border-b-2 border-brand text-brand" : "text-stone-500"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <main className="app-main flex min-h-0 flex-1">
        <aside
          className={`no-print w-full shrink-0 overflow-y-auto border-r border-stone-200 bg-stone-50 p-4 lg:block lg:w-[460px] ${
            tab === "edit" ? "block" : "hidden"
          }`}
        >
          <Editor cv={state.cv} onChange={setCV} />
          <p className="mt-4 text-center text-xs text-stone-400">Saved in this browser automatically.</p>
        </aside>

        <section
          className={`preview-pane min-w-0 flex-1 overflow-y-auto px-4 py-5 lg:block ${
            tab === "preview" ? "block" : "hidden"
          }`}
        >
          {/* Remount when the mobile tab changes: Chrome can keep a stale layout for content shown after display:none. */}
          <Preview key={tab} cv={state.cv} template={state.template} />
          <p className="no-print mx-auto mt-4 max-w-md text-center text-xs text-stone-400">
            In the print window choose <b className="font-medium text-stone-500">Save as PDF</b> and turn off{" "}
            <b className="font-medium text-stone-500">Headers and footers</b>.
          </p>
        </section>
      </main>

      {notice && (
        <div
          role="status"
          className="no-print fixed bottom-5 left-1/2 -translate-x-1/2 rounded-md bg-stone-900 px-4 py-2 text-sm text-white shadow-lg"
        >
          {notice}
        </div>
      )}
    </div>
  );
}
