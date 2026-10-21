"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { emptyCV, loadSaved, normalizeCV, save, type Saved } from "@/lib/cv";
import { DEFAULT_EDITOR_WIDTH, loadLayout, saveLayout, type Layout, type ViewMode, type Zoom } from "@/lib/layout";
import { downloadCvPdf } from "@/lib/pdf";
import { sampleCV } from "@/lib/sample";
import { STEPS, type StepId } from "@/lib/steps";
import type { CV, TemplateId } from "@/lib/types";
import { CVDocument } from "@/templates";
import { DownloadIcon, EditorIcon, MoreIcon, PreviewIcon, TemplatesIcon } from "./icons";
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

const FRESH: Saved = { cv: emptyCV, template: "classic", accent: null, step: 0, started: false };

export default function Builder() {
  // Rendered on the client only (see BuilderLoader), so reading localStorage here is safe.
  const [state, setState] = useState<Saved>(() => loadSaved() ?? FRESH);
  const [layout, setLayout] = useState<Layout>(loadLayout);
  const [exporting, setExporting] = useState(false);
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
  const setAccent = (accent: string | null) => update({ accent });
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

  function printPdf() {
    const previous = document.title;
    document.title = `${state.cv.personal.name.trim() || "My"} CV`;
    window.print();
    document.title = previous;
  }

  async function downloadPdf() {
    if (exporting) return;
    const sheet = document.querySelector<HTMLElement>(".print-only .paper");
    if (!sheet) return printPdf();
    const name = state.cv.personal.name.trim();
    const slug = (name || "my").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setExporting(true);
    try {
      await downloadCvPdf(sheet, {
        fileName: `${slug}-cv.pdf`,
        title: `${name || "My"} CV`,
        author: name,
      });
      setNotice("PDF downloaded");
    } catch (err) {
      console.error(err);
      setNotice("Couldn't build the PDF here, opening print instead");
      printPdf();
    } finally {
      setExporting(false);
    }
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

  const menuItem = "block w-full rounded-lg px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-100";
  const onFinish = STEPS[state.step]?.id === "finish";

  return (
    <>
      <div className="no-print flex h-dvh flex-col bg-stone-100">
        <header className="relative z-40 grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-stone-200 bg-white px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand text-[11px] font-bold tracking-wide text-white shadow-sm shadow-brand/30">
              CV
            </span>
            <div className="hidden min-w-0 flex-col leading-tight sm:flex">
              <span className="truncate text-sm font-semibold text-stone-900">
                {state.cv.personal.name.trim() ? `${state.cv.personal.name.trim()}'s CV` : "Untitled CV"}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-stone-500">
                <span className="size-1.5 rounded-full bg-emerald-500" /> Saved in this browser
              </span>
            </div>
          </div>

          <ViewSwitcher mode={mode} onMode={setMode} allowSplit={isDesktop} />

          <div className="flex items-center justify-end gap-1">
            <Link
              href="/templates"
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 lg:flex"
            >
              <TemplatesIcon className="size-4" /> Templates
            </Link>
            {!onFinish && (
              <button
                type="button"
                onClick={downloadPdf}
                disabled={exporting}
                aria-busy={exporting}
                className="hidden items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark disabled:cursor-wait disabled:opacity-80 sm:flex"
              >
                {exporting ? <Spinner /> : <DownloadIcon className="size-4" />}
                <span className="hidden xl:inline">{exporting ? "Preparing PDF…" : "Download PDF"}</span>
                <span className="xl:hidden">PDF</span>
              </button>
            )}
            <details ref={menuRef} className="relative [&_summary::-webkit-details-marker]:hidden">
              <summary
                aria-label="More actions"
                title="More actions"
                className="grid size-9 cursor-pointer list-none place-items-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
              >
                <MoreIcon className="size-5" />
              </summary>
              <div className="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-xl border border-stone-200 bg-white p-1 shadow-xl">
                <button type="button" className={menuItem} onClick={() => { closeMenu(); fileRef.current?.click(); }}>
                  Import backup (.json)
                </button>
                <button type="button" className={menuItem} onClick={() => { closeMenu(); exportJson(); }}>
                  Save backup (.json)
                </button>
                <button type="button" className={menuItem} onClick={() => { closeMenu(); loadExample(); }}>
                  Load example CV
                </button>
                <button type="button" className={menuItem} onClick={() => { closeMenu(); printPdf(); }}>
                  Print or save with the browser
                </button>
                {isDesktop && (
                  <>
                    <div className="mx-2 my-1 border-t border-stone-100" />
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
                      onClick={() => { closeMenu(); setLayout((l) => ({ ...l, mode: "split", editorWidth: DEFAULT_EDITOR_WIDTH, zoom: "width" })); }}
                    >
                      Reset layout
                    </button>
                  </>
                )}
                <div className="mx-2 my-1 border-t border-stone-100" />
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
              accent={state.accent}
              onAccent={setAccent}
              onDownload={downloadPdf}
              onExport={exportJson}
            />
          }
          preview={
            <Preview
              cv={state.cv}
              template={state.template}
              onTemplate={setTemplate}
              accent={state.accent}
              onAccent={setAccent}
              zoom={layout.zoom}
              onZoom={setZoom}
              activeStep={STEPS[state.step]?.id}
              onEditSection={editSection}
              onSwap={isDesktop && mode === "split" ? () => setLayout((l) => ({ ...l, previewFirst: !l.previewFirst })) : undefined}
            />
          }
        />

        {isDesktop && mode === "editor" && (
          <MiniPreview cv={state.cv} template={state.template} accent={state.accent} onOpen={() => setMode("split")} />
        )}

        {!isDesktop && (
          <button
            type="button"
            onClick={mode === "preview" ? downloadPdf : () => setMode("preview")}
            className={`fixed right-4 z-30 flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition ${
              mode === "preview" ? "bottom-5 bg-brand" : "bottom-[76px] bg-stone-900"
            }`}
          >
            {mode === "preview" ? (exporting ? "Preparing PDF…" : "Download PDF") : (<><PreviewIcon className="size-4" /> Preview</>)}
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
          <CVDocument cv={state.cv} template={state.template} accent={state.accent} />
        </div>
      </div>

      {fileInput}
      {toast}
    </>
  );
}

function Spinner() {
  return <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />;
}
