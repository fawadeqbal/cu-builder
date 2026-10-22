"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { cvToText, emptyCV, normalizeCV, sampleCV, type CV } from "@cvb/domain";
import type { TemplateId } from "@cvb/templates/catalog";
import { CVDocument } from "@cvb/templates";
import { CloudIcon, DownloadIcon, EditorIcon, HistoryIcon, LockIcon, MoreIcon, PreviewIcon, ShareIcon, TemplatesIcon } from "@cvb/ui";
import { hasFeature, isUnlocked, usePlan } from "@/lib/access";
import { track } from "@/lib/analytics";
import { api } from "@/lib/api";
import { useCatalog } from "@/lib/catalog";
import { FRESH, fileSlug } from "@/lib/cv";
import type { DocumentController, SaveStatus } from "@/lib/document";
import { downloadBlob } from "@/lib/download";
import type { ExportActions, ExportFormat } from "@/lib/exports";
import { DEFAULT_EDITOR_WIDTH, loadLayout, saveLayout, type Layout, type ViewMode, type Zoom } from "@/lib/layout";
import { PAGE_SIZES, paperSizeAttr, type PageSize } from "@/lib/page";
import { downloadCvPdf } from "@/lib/pdf";
import type { Gate } from "@/lib/plans";
import { PLAN_LABEL, planForGate } from "@/lib/plans";
import { STEPS, type StepId } from "@/lib/steps";
import { HistoryDialog } from "./HistoryDialog";
import { MiniPreview, Preview } from "./Preview";
import { ShareDialog } from "./ShareDialog";
import { SplitView } from "./SplitView";
import { UpgradeDialog } from "./UpgradeDialog";
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

type Props = {
  doc: DocumentController;
  /** Present when the CV is stored in the user's account. */
  cloud?: { resumeId: string; title: string; onRename: (title: string) => void };
  /** Shown above the workspace (for example the import review notes). */
  banner?: ReactNode;
};

/**
 * The CV editor. It doesn't know where the CV is stored: it reads and writes through the
 * DocumentController it is given (browser storage for guests, the API for accounts).
 */
export default function Builder({ doc, cloud, banner }: Props) {
  const { state, update } = doc;
  const { plan, signedIn } = usePlan();
  const catalog = useCatalog();
  const [layout, setLayout] = useState<Layout>(loadLayout);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [notice, setNotice] = useState("");
  const [gate, setGate] = useState<Gate | null>(null);
  const [sharing, setSharing] = useState(false);
  const [history, setHistory] = useState(false);
  /** A template the plan doesn't include, shown in the preview only until the user upgrades. */
  const [trial, setTrial] = useState<TemplateId | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const isDesktop = useIsDesktop();

  // Once the plan covers the template being tried (say, after an upgrade in another tab), it is simply the template.
  const trying = trial && trial !== state.template && !isUnlocked(plan, catalog.meta(trial).tier) ? trial : null;
  const template = trying ?? state.template;
  const templateMeta = catalog.meta(template);
  const templateLocked = !isUnlocked(plan, templateMeta.tier);

  useEffect(() => {
    saveLayout(layout);
  }, [layout]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 2800);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (trial && trial !== state.template && isUnlocked(plan, catalog.meta(trial).tier)) update({ template: trial });
  }, [plan, trial, state.template, catalog, update]);

  const setCV = (cv: CV) => update({ cv });
  const setAccent = (accent: string | null) => update({ accent });
  const closeMenu = () => menuRef.current?.removeAttribute("open");

  function setTemplate(id: TemplateId) {
    track("template_selected", { template: id });
    if (isUnlocked(plan, catalog.meta(id).tier)) {
      setTrial(null);
      update({ template: id });
    } else {
      setTrial(id === state.template ? null : id);
    }
  }

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

  // Funnel: reaching the last step counts as completing the CV.
  const onFinish = STEPS[state.step]?.id === "finish";
  useEffect(() => {
    if (onFinish) track("cv_completed");
  }, [onFinish]);

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

  /** A restore point each time a cloud CV is downloaded. */
  async function snapshotOnDownload() {
    if (!cloud) return;
    await doc.flush();
    await api.post(`/resumes/${cloud.resumeId}/versions`, { reason: "download" }).catch(() => undefined);
  }

  const locked: ExportFormat[] = hasFeature(plan, "export.docx") ? [] : ["docx", "txt"];

  async function exportAs(format: ExportFormat) {
    closeMenu();
    if (busy) return;
    const slug = fileSlug(state.cv);
    const name = state.cv.personal.name.trim();

    if (format === "json") {
      const blob = new Blob([JSON.stringify(state.cv, null, 2)], { type: "application/json" });
      downloadBlob(blob, `${slug}-cv.json`);
      setNotice("Backup saved");
      return;
    }
    if (format !== "pdf" && locked.includes(format)) return setGate({ kind: "feature", feature: "export.docx" });
    if (format === "pdf" && templateLocked) return setGate({ kind: "tier", tier: templateMeta.tier, name: templateMeta.name });

    setBusy(format);
    try {
      if (format === "pdf") {
        const sheet = document.querySelector<HTMLElement>(".print-only .paper");
        if (!sheet) return printPdf();
        await downloadCvPdf(sheet, {
          fileName: `${slug}-cv.pdf`,
          title: `${name || "My"} CV`,
          author: name,
          pageSize: state.pageSize,
          footer: plan === "free" ? `Made with CV Builder · ${window.location.host}` : undefined,
        });
        track("pdf_downloaded", { template, pageSize: state.pageSize });
        setNotice("PDF downloaded");
      } else if (format === "docx") {
        const { buildCvDocx } = await import("@/lib/docx");
        downloadBlob(await buildCvDocx(state.cv, { accent: state.accent ?? templateMeta.accent, pageSize: state.pageSize }), `${slug}-cv.docx`);
        track("docx_downloaded");
        setNotice("Word file downloaded");
      } else {
        downloadBlob(new Blob([cvToText(state.cv)], { type: "text/plain;charset=utf-8" }), `${slug}-cv.txt`);
        setNotice("Text file downloaded");
      }
      void snapshotOnDownload();
    } catch (err) {
      console.error(err);
      if (format === "pdf") {
        setNotice("Couldn't build the PDF here, opening print instead");
        printPdf();
      } else setNotice("Couldn't create that file. Please try again.");
    } finally {
      setBusy(null);
    }
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
    setTrial(null);
    update(cloud ? { cv: emptyCV, step: 0 } : FRESH);
  }

  function loadExample() {
    if (state.started && !window.confirm("Replace your CV with the example?")) return;
    update({ cv: sampleCV, started: true, step: 0 });
  }

  const actions: ExportActions = {
    exportAs: (f) => void exportAs(f),
    busy,
    locked,
    pageSize: state.pageSize,
    onPageSize: (pageSize: PageSize) => update({ pageSize }),
    templatesHref: cloud ? `/templates?resume=${cloud.resumeId}` : "/templates",
  };

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
    <div role="status" className="no-print fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-md bg-stone-900 px-4 py-2 text-sm text-white shadow-lg lg:bottom-6">
      {notice}
    </div>
  );

  if (!state.started) {
    return (
      <>
        <Welcome
          onStart={() => {
            track("cv_started");
            update({ cv: emptyCV, started: true, step: 0 });
          }}
          onExample={loadExample}
          onImport={() => fileRef.current?.click()}
          signedIn={signedIn}
        />
        {fileInput}
        {toast}
      </>
    );
  }

  const menuItem = "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-100";
  const title = cloud?.title ?? (state.cv.personal.name.trim() ? `${state.cv.personal.name.trim()}'s CV` : "Untitled CV");
  const share = () => (cloud && hasFeature(plan, "share.link") ? setSharing(true) : setGate({ kind: "feature", feature: "share.link" }));

  return (
    <>
      <div className="no-print flex h-dvh flex-col bg-stone-100">
        <header className="relative z-40 grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-stone-200 bg-white px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              href={signedIn ? "/app" : "/"}
              title={signedIn ? "My CVs" : "CV Builder"}
              className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand text-[11px] font-bold tracking-wide text-white shadow-sm shadow-brand/30"
            >
              CV
            </Link>
            <div className="hidden min-w-0 flex-col leading-tight sm:flex">
              {cloud ? <TitleField title={cloud.title} onRename={cloud.onRename} /> : <span className="truncate text-sm font-semibold text-stone-900">{title}</span>}
              <SaveIndicator status={doc.status} conflict={doc.conflict} />
            </div>
          </div>

          <ViewSwitcher mode={mode} onMode={setMode} allowSplit={isDesktop} />

          <div className="flex items-center justify-end gap-1">
            <Link
              href={actions.templatesHref}
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 xl:flex"
            >
              <TemplatesIcon className="size-4" /> Templates
            </Link>
            <button
              type="button"
              onClick={share}
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 md:flex"
            >
              <ShareIcon className="size-4" /> Share
            </button>
            {!signedIn && (
              <Link
                href="/sign-up?next=/app"
                className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 lg:flex"
              >
                <CloudIcon className="size-4" /> Save to account
              </Link>
            )}
            {!onFinish && (
              <button
                type="button"
                onClick={() => void exportAs("pdf")}
                disabled={busy === "pdf"}
                aria-busy={busy === "pdf"}
                className="hidden items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark disabled:cursor-wait disabled:opacity-80 sm:flex"
              >
                {busy === "pdf" ? <Spinner /> : templateLocked ? <LockIcon className="size-4" /> : <DownloadIcon className="size-4" />}
                <span className="hidden xl:inline">{busy === "pdf" ? "Preparing PDF…" : "Download PDF"}</span>
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
              <div className="absolute right-0 z-40 mt-2 max-h-[80dvh] w-64 overflow-y-auto rounded-xl border border-stone-200 bg-white p-1 shadow-xl">
                <MenuLabel>Download</MenuLabel>
                {(["docx", "txt"] as const).map((f) => (
                  <button key={f} type="button" className={menuItem} onClick={() => void exportAs(f)}>
                    {f === "docx" ? "Word document (.docx)" : "Plain text (.txt)"}
                    {locked.includes(f) && <LockIcon className="ml-auto size-3.5 text-stone-400" />}
                  </button>
                ))}
                <button type="button" className={menuItem} onClick={() => { closeMenu(); printPdf(); }}>
                  Print or save with the browser
                </button>
                <div className="flex items-center justify-between px-3 py-2 text-sm text-stone-700">
                  Page size
                  <div role="radiogroup" aria-label="Page size" className="flex rounded-md bg-stone-100 p-0.5 text-xs">
                    {(Object.keys(PAGE_SIZES) as PageSize[]).map((size) => (
                      <button
                        key={size}
                        type="button"
                        role="radio"
                        aria-checked={state.pageSize === size}
                        onClick={() => update({ pageSize: size })}
                        className={`rounded px-2 py-0.5 font-medium ${state.pageSize === size ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"}`}
                      >
                        {size === "A4" ? "A4" : "Letter"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mx-2 my-1 border-t border-stone-100" />
                <MenuLabel>CV</MenuLabel>
                <button type="button" className={`${menuItem} md:hidden`} onClick={() => { closeMenu(); share(); }}>
                  <ShareIcon className="size-4" /> Share link
                </button>
                {cloud && (
                  <button type="button" className={menuItem} onClick={() => { closeMenu(); setHistory(true); }}>
                    <HistoryIcon className="size-4" /> Version history
                  </button>
                )}
                <button type="button" className={menuItem} onClick={() => { closeMenu(); fileRef.current?.click(); }}>
                  Import backup (.json)
                </button>
                <button type="button" className={menuItem} onClick={() => void exportAs("json")}>
                  Save backup (.json)
                </button>
                <button type="button" className={menuItem} onClick={() => { closeMenu(); loadExample(); }}>
                  Load example CV
                </button>
                {isDesktop && (
                  <>
                    <div className="mx-2 my-1 border-t border-stone-100" />
                    <MenuLabel>Layout</MenuLabel>
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
                  {cloud ? "Clear this CV" : "Start over"}
                </button>
              </div>
            </details>
          </div>
        </header>

        {doc.conflict && (
          <div role="alert" className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
            <span className="flex-1">This CV was changed on another device while you were editing here.</span>
            <button type="button" className="font-semibold underline-offset-2 hover:underline" onClick={() => doc.resolveConflict("theirs")}>
              Load the newer version
            </button>
            <button type="button" className="font-semibold underline-offset-2 hover:underline" onClick={() => doc.resolveConflict("mine")}>
              Keep mine
            </button>
          </div>
        )}
        {trying && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-violet-200 bg-violet-50 px-4 py-2 text-sm text-violet-900">
            <span className="flex-1">
              You&apos;re previewing <strong>{templateMeta.name}</strong>, a {PLAN_LABEL[planForGate({ kind: "tier", tier: templateMeta.tier, name: "" })]} template.
            </span>
            <button type="button" className="font-semibold underline-offset-2 hover:underline" onClick={() => setGate({ kind: "tier", tier: templateMeta.tier, name: templateMeta.name })}>
              Unlock it
            </button>
            <button type="button" className="font-semibold underline-offset-2 hover:underline" onClick={() => setTrial(null)}>
              Back to {catalog.meta(state.template).name}
            </button>
          </div>
        )}
        {banner}

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
              template={template}
              onTemplate={setTemplate}
              accent={state.accent}
              onAccent={setAccent}
              actions={actions}
            />
          }
          preview={
            <Preview
              cv={state.cv}
              template={template}
              onTemplate={setTemplate}
              accent={state.accent}
              onAccent={setAccent}
              pageSize={state.pageSize}
              templatesHref={actions.templatesHref}
              zoom={layout.zoom}
              onZoom={setZoom}
              activeStep={STEPS[state.step]?.id}
              onEditSection={editSection}
              onSwap={isDesktop && mode === "split" ? () => setLayout((l) => ({ ...l, previewFirst: !l.previewFirst })) : undefined}
            />
          }
        />

        {isDesktop && mode === "editor" && <MiniPreview cv={state.cv} template={template} accent={state.accent} onOpen={() => setMode("split")} />}

        {!isDesktop && (
          <button
            type="button"
            onClick={mode === "preview" ? () => void exportAs("pdf") : () => setMode("preview")}
            className={`fixed right-4 z-30 flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition ${
              mode === "preview" ? "bottom-5 bg-brand" : "bottom-[76px] bg-stone-900"
            }`}
          >
            {mode === "preview" ? (busy === "pdf" ? "Preparing PDF…" : "Download PDF") : (<><PreviewIcon className="size-4" /> Preview</>)}
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
        {state.pageSize === "LETTER" && <style>{"@page{size:letter}"}</style>}
        <div className="paper" data-size={paperSizeAttr(state.pageSize)}>
          <CVDocument cv={state.cv} template={template} accent={state.accent} />
        </div>
      </div>

      <UpgradeDialog gate={gate} onClose={() => setGate(null)} />
      {cloud && (
        <>
          <ShareDialog resumeId={cloud.resumeId} open={sharing} onClose={() => setSharing(false)} onUpgrade={setGate} />
          <HistoryDialog
            resumeId={cloud.resumeId}
            open={history}
            onClose={() => setHistory(false)}
            beforeChange={doc.flush}
            onRestored={(r) => {
              doc.applyServer(r);
              setNotice("Version restored");
            }}
          />
        </>
      )}
      {fileInput}
      {toast}
    </>
  );
}

function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-stone-400">{children}</div>;
}

const STATUS: Record<SaveStatus, { text: string; dot: string }> = {
  local: { text: "Saved in this browser", dot: "bg-emerald-500" },
  saving: { text: "Saving…", dot: "bg-amber-400 animate-pulse" },
  saved: { text: "Saved to your account", dot: "bg-emerald-500" },
  offline: { text: "Offline, will sync when you're back", dot: "bg-stone-400" },
  error: { text: "Couldn't save, retrying", dot: "bg-red-500" },
};

function SaveIndicator({ status, conflict }: { status: SaveStatus; conflict: boolean }) {
  const s = conflict ? { text: "Two versions: choose one above", dot: "bg-amber-500" } : STATUS[status];
  return (
    <span className="flex items-center gap-1.5 text-xs text-stone-500" aria-live="polite">
      <span className={`size-1.5 rounded-full ${s.dot}`} /> {s.text}
    </span>
  );
}

/** The CV's name in the header; click to rename. */
function TitleField({ title, onRename }: { title: string; onRename: (t: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  if (!editing) {
    return (
      <button
        type="button"
        title="Rename"
        onClick={() => {
          setValue(title);
          setEditing(true);
        }}
        className="-mx-1 truncate rounded px-1 text-left text-sm font-semibold text-stone-900 hover:bg-stone-100"
      >
        {title}
      </button>
    );
  }
  const commit = () => {
    setEditing(false);
    const next = value.trim();
    if (next && next !== title) onRename(next.slice(0, 120));
  };
  return (
    <input
      autoFocus
      aria-label="CV name"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
      }}
      className="-mx-1 w-56 rounded px-1 text-sm font-semibold text-stone-900 outline-none ring-2 ring-brand"
    />
  );
}

function Spinner() {
  return <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />;
}
