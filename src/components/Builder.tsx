"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { emptyCV, loadSaved, save, type Saved } from "@/lib/cv";
import { sampleCV } from "@/lib/sample";
import { STEPS } from "@/lib/steps";
import type { CV, TemplateId } from "@/lib/types";
import { CVDocument } from "@/templates";
import { AiProvider, AiStatusButton } from "./ai/AiProvider";
import { ImportDialog } from "./ImportDialog";
import { Preview } from "./Preview";
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

const FRESH: Saved = { cv: emptyCV, template: "classic", step: 0, started: false, jobAd: "" };

export default function Builder() {
  return (
    <AiProvider>
      <BuilderApp />
    </AiProvider>
  );
}

function BuilderApp() {
  // Rendered on the client only (see BuilderLoader), so reading localStorage here is safe.
  const [state, setState] = useState<Saved>(() => loadSaved() ?? FRESH);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    save(state);
  }, [state]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 2500);
    return () => clearTimeout(t);
  }, [notice]);

  const update = (patch: Partial<Saved>) => setState((s) => ({ ...s, ...patch }));
  const setCV = (cv: CV) => update({ cv });
  const setTemplate = (template: TemplateId) => update({ template });
  const closeMenu = () => menuRef.current?.removeAttribute("open");

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

  function importCV(cv: CV) {
    update({ cv, started: true, step: 0 });
    setImportOpen(false);
    setNotice("CV imported. Check each step, then download");
  }

  function startOver() {
    if (!window.confirm("Start over? Everything you entered will be cleared.")) return;
    setState(FRESH);
  }

  function loadExample() {
    if (state.started && !window.confirm("Replace your CV with the example?")) return;
    update({ cv: sampleCV, started: true, step: 0 });
  }

  const importDialog = importOpen && <ImportDialog onClose={() => setImportOpen(false)} onImport={importCV} />;

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
          onImport={() => setImportOpen(true)}
        />
        {importDialog}
        {toast}
      </>
    );
  }

  const menuItem = "block w-full px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-100";
  const onFinish = STEPS[state.step]?.id === "finish";

  return (
    <>
      <div className="no-print flex h-dvh flex-col bg-stone-100">
        <header className="flex items-center gap-3 border-b border-stone-200 bg-white px-4 py-2.5">
          <span className="grid size-7 place-items-center rounded-md bg-brand text-xs font-bold text-white">CV</span>
          <span className="text-[15px] font-semibold tracking-tight text-stone-900">CV Builder</span>
          <span className="hidden items-center gap-1.5 text-xs text-stone-400 sm:flex">
            <span className="size-1.5 rounded-full bg-emerald-500" /> Saved in this browser
          </span>

          <div className="ml-auto flex items-center gap-1">
            <AiStatusButton />
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
              <div className="absolute right-0 z-40 mt-1 w-52 overflow-hidden rounded-lg border border-stone-200 bg-white py-1 shadow-lg">
                <button type="button" className={menuItem} onClick={() => { closeMenu(); setImportOpen(true); }}>
                  Import CV (PDF, Word, JSON)
                </button>
                <button type="button" className={menuItem} onClick={() => { closeMenu(); exportJson(); }}>
                  Save backup (.json)
                </button>
                <button type="button" className={menuItem} onClick={() => { closeMenu(); loadExample(); }}>
                  Load example CV
                </button>
                <div className="my-1 border-t border-stone-100" />
                <button type="button" className={`${menuItem} !text-red-600`} onClick={() => { closeMenu(); startOver(); }}>
                  Start over
                </button>
              </div>
            </details>
          </div>
        </header>

        <main className="flex min-h-0 flex-1">
          <div className="flex min-h-0 w-full flex-col lg:w-[540px] lg:shrink-0 lg:border-r lg:border-stone-200">
            <Wizard
              cv={state.cv}
              onChange={setCV}
              step={state.step}
              onStep={(step) => update({ step })}
              template={state.template}
              onTemplate={setTemplate}
              onDownload={downloadPdf}
              onExport={exportJson}
              jobAd={state.jobAd}
              onJobAd={(jobAd) => update({ jobAd })}
            />
          </div>

          {isDesktop && (
            <section aria-label="CV preview" className="min-w-0 flex-1 overflow-y-auto px-6 py-6">
              <Preview cv={state.cv} template={state.template} />
            </section>
          )}
        </main>

        {!isDesktop && (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="fixed bottom-[76px] right-4 z-30 flex items-center gap-1.5 rounded-full bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg"
          >
            <svg viewBox="0 0 20 20" className="size-4" fill="currentColor" aria-hidden="true">
              <path d="M10 4C5.5 4 2.3 7.6 1.3 9.6a.9.9 0 0 0 0 .8C2.3 12.4 5.5 16 10 16s7.7-3.6 8.7-5.6a.9.9 0 0 0 0-.8C17.7 7.6 14.5 4 10 4Zm0 9.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" />
            </svg>
            Preview
          </button>
        )}

        {!isDesktop && previewOpen && (
          <div role="dialog" aria-modal="true" aria-label="CV preview" className="fixed inset-0 z-50 flex flex-col bg-stone-100">
            <div className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-2.5">
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="rounded-md px-2 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                ← Back to editing
              </button>
              <button
                type="button"
                onClick={downloadPdf}
                className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white"
              >
                Download PDF
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <Preview cv={state.cv} template={state.template} />
            </div>
          </div>
        )}
      </div>

      {/* The only thing that prints: a clean copy of the CV. */}
      <div className="print-only">
        <div className="paper">
          <CVDocument cv={state.cv} template={state.template} />
        </div>
      </div>

      {importDialog}
      {toast}
    </>
  );
}
