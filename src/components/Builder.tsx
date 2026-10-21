"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { emptyCV, loadSaved, normalizeCV, save, type Saved } from "@/lib/cv";
import { loadLayout, saveLayout, type Layout, type ViewMode, type Zoom } from "@/lib/layout";
import { sampleCV } from "@/lib/sample";
import { STEPS, type StepId } from "@/lib/steps";
import type { CV, TemplateId } from "@/lib/types";
import { CVDocument } from "@/templates";
import { PreviewIcon, EditorIcon } from "./icons";
import { MiniPreview, Preview } from "./Preview";
import { SplitView } from "./SplitView";
import { ViewSwitcher } from "./ViewSwitcher";
import { Welcome } from "./Welcome";
import { Wizard } from "./Wizard";

const DESKTOP = "(min-width: 1024px)";

function useIsDesktop() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(DESKTOP);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(DESKTOP).matches,
    () => true,
  );
}

const FRESH: Saved = { cv: emptyCV, template: "classic", step: 0, started: false };

export default function Builder() {
  // Rendered on the client only (see BuilderLoader), so reading localStorage here is safe.
  const [state, setState] = useState<Saved>(() => loadSaved() ?? FRESH);
  const [layout, setLayout] = useState<Layout>(loadLayout);
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    save(state);
  }, [state]);

  useEffect(() => {
    saveLayout(layout);
  }, [layout]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 2500);
    return () => clearTimeout(t);
  }, [notice]);

  const update = (patch: Partial<Saved>) => setState((s) => ({ ...s, ...patch }));
  const setCV = (cv: CV) => update({ cv });
  const setTemplate = (template: TemplateId) => update({ template });
  const closeMenu = () => menuRef.current?.removeAttribute("open");

  // Phones only have room for one pane, so split view shows the editor there.
  const mode: ViewMode = isDesktop ? layout.mode : layout.mode === "preview" ? "preview" : "editor";
  const setMode = useCallback(
    (next: ViewMode) => setLayout((l) => ({ ...l, mode: !isDesktop && next === "editor" && l.mode === "split" ? "split" : next })),
    [isDesktop],
  );
  const setZoom = useCallback((zoom: Zoom) => setLayout((l) => ({ ...l, zoom })), []);

  // Alt+1/2/3 switch views; Ctrl/⌘+\ shows or hides the preview next to the editor.
  useEffect(() => {
    if (!state.started) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const keys: Record<string, ViewMode> = { Digit1: "editor", Digit2: "split", Digit3: "preview" };
        const next = keys[e.code];
        if (!next || (!isDesktop && next === "split")) return;
        e.preventDefault();
        setMode(next);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
        e.preventDefault();
        setLayout((l) => ({ ...l, mode: l.mode === "split" ? "editor" : "split" }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.started, isDesktop, setMode]);

  function collapseTo(next: ViewMode) {
    setMode(next);
    setNotice(next === "editor" ? "Preview hidden. Press Alt+2 to bring it back" : "Editor hidden. Press Alt+2 to bring it back");
  }

  function editSection(id: StepId) {
    const index = STEPS.findIndex((s) => s.id === id);
    if (index >= 0) update({ step: index });
    if (mode === "preview") setMode(isDesktop ? "split" : "editor");
  }

  function downloadPdf() {
    const previous = document.title;
    document.title = `${state.cv.personal.name.trim() || "My"} CV`;
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
    setNotice("Backup saved");
  }

  async function importJson(file: File) {
    try {
      const cv = normalizeCV(JSON.parse(await file.text()));
      update({ cv, started: true, step: 0 });
      setNotice("CV imported. Check each step, then download");
    } catch {
      setNotice("That file isn't a valid CV backup");
    }
  }

  function startOver() {
    if (!window.confirm("Start over? Everything you entered will be cleared.")) return;
    setState(FRESH);
  }

  function loadExample() {
    if (state.started && !window.confirm("Replace your CV with the example?")) return;
    update({ cv: sampleCV, started: true, step: 0 });
  }

  const fileInput = (
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
  );

  const toast = notice && (
    <div
      role="status"
      className="no-print fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-md bg-stone-900 px-4 py-2 text-sm text-white shadow-lg lg:bottom-6"
    >
      {notice}
    </div>
  );

  if (!state.started) {
    return (
      <>
        <Welcome
          onStart={() => update({ cv: emptyCV, started: true, step: 0 })}
          onExample={loadExample}
          onImport={() => fileRef.current?.click()}
        />
        {fileInput}
        {toast}
      </>
    );
  }

  const menuItem = "block w-full px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-100";
  const onFinish = STEPS[state.step]?.id === "finish";

  return (
    <>
      <div className="no-print flex h-dvh flex-col bg-stone-100">
        <header className="relative z-40 grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-stone-200 bg-white px-3 py-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-brand text-xs font-bold text-white">CV</span>
            <span className="hidden text-[15px] font-semibold tracking-tight text-stone-900 sm:inline">CV Builder</span>
            <span className="hidden items-center gap-1.5 truncate text-xs text-stone-400 xl:flex">
              <span className="size-1.5 rounded-full bg-emerald-500" /> Saved in this browser
            </span>
          </div>

          <ViewSwitcher mode={mode} onMode={setMode} allowSplit={isDesktop} />

          <div className="flex items-center justify-end gap-1">
            {!onFinish && (
              <button
                type="button"
                onClick={downloadPdf}
                className="hidden rounded-md px-3 py-1.5 text-sm font-medium text-brand hover:bg-brand/5 sm:block"
              >
                Download PDF
              </button>
            )}
            <details ref={menuRef} className="relative [&_summary::-webkit-details-marker]:hidden">
              <summary className="cursor-pointer list-none rounded-md px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-100">
                More ▾
              </summary>
              <div className="absolute right-0 z-40 mt-1 w-56 overflow-hidden rounded-lg border border-stone-200 bg-white py-1 shadow-lg">
                <button type="button" className={menuItem} onClick={() => { closeMenu(); fileRef.current?.click(); }}>
                  Import backup (.json)
                </button>
                <button type="button" className={menuItem} onClick={() => { closeMenu(); exportJson(); }}>
                  Save backup (.json)
                </button>
                <button type="button" className={menuItem} onClick={() => { closeMenu(); loadExample(); }}>
                  Load example CV
                </button>
                {isDesktop && (
                  <>
                    <div className="my-1 border-t border-stone-100" />
                    <button
                      type="button"
                      className={menuItem}
                      onClick={() => { closeMenu(); setLayout((l) => ({ ...l, mode: "split", previewFirst: !l.previewFirst })); }}
                    >
                      Put preview on the {layout.previewFirst ? "right" : "left"}
                    </button>
                    <button
                      type="button"
                      className={menuItem}
                      onClick={() => { closeMenu(); setLayout((l) => ({ ...l, mode: "split", editorWidth: 540, zoom: "width" })); }}
                    >
                      Reset layout
                    </button>
                  </>
                )}
                <div className="my-1 border-t border-stone-100" />
                <button type="button" className={`${menuItem} !text-red-600`} onClick={() => { closeMenu(); startOver(); }}>
                  Start over
                </button>
              </div>
            </details>
          </div>
        </header>

        <SplitView
          mode={mode}
          editorWidth={layout.editorWidth}
          previewFirst={layout.previewFirst}
          onResize={(editorWidth) => setLayout((l) => ({ ...l, editorWidth }))}
          onMode={collapseTo}
          editor={
            <Wizard
              cv={state.cv}
              onChange={setCV}
              step={state.step}
              onStep={(step) => update({ step })}
              template={state.template}
              onTemplate={setTemplate}
              onDownload={downloadPdf}
              onExport={exportJson}
            />
          }
          preview={
            <Preview
              cv={state.cv}
              template={state.template}
              onTemplate={setTemplate}
              zoom={layout.zoom}
              onZoom={setZoom}
              activeStep={STEPS[state.step]?.id}
              onEditSection={editSection}
              onSwap={isDesktop && mode === "split" ? () => setLayout((l) => ({ ...l, previewFirst: !l.previewFirst })) : undefined}
            />
          }
        />

        {isDesktop && mode === "editor" && (
          <MiniPreview cv={state.cv} template={state.template} onOpen={() => setMode("split")} />
        )}

        {!isDesktop && (
          <button
            type="button"
            onClick={mode === "preview" ? downloadPdf : () => setMode("preview")}
            className={`fixed right-4 z-30 flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition ${
              mode === "preview" ? "bottom-5 bg-brand" : "bottom-[76px] bg-stone-900"
            }`}
          >
            {mode === "preview" ? "Download PDF" : (<><PreviewIcon className="size-4" /> Preview</>)}
          </button>
        )}
        {!isDesktop && mode === "preview" && (
          <button
            type="button"
            onClick={() => setMode("editor")}
            className="fixed bottom-5 left-4 z-30 flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 shadow-lg ring-1 ring-stone-900/10"
          >
            <EditorIcon className="size-4" /> Edit
          </button>
        )}
      </div>

      {/* The only thing that prints: a clean copy of the CV. */}
      <div className="print-only">
        <div className="paper">
          <CVDocument cv={state.cv} template={state.template} />
        </div>
      </div>

      {fileInput}
      {toast}
    </>
  );
}
