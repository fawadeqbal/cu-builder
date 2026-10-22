"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { atsReport, can, cvToText, emptyCV, normalizeCV, sampleCV, type CV } from "@cvb/domain";
import type { TemplateId } from "@cvb/templates/catalog";
import { CVDocument } from "@cvb/templates";
import { Alert, Badge, Button, CloudIcon, Dropdown, HistoryIcon, Icon, IconButton, LogoMark, SegmentedControl, Toast } from "@cvb/ui";
import { hasFeature, isUnlocked, usePlan } from "@/lib/access";
import { AiAssistContext, useCredits, type AiAssist } from "@/lib/ai";
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
import { LinkedInDialog } from "./ai/LinkedInDialog";
import { OptimiseDialog } from "./ai/OptimiseDialog";
import { AtsPanel } from "./ats/AtsPanel";
import { HistoryDialog } from "./HistoryDialog";
import { MatchDialog } from "./jobs/MatchDialog";
import { Dialog } from "./ui/Dialog";
import { MiniPreview, Preview } from "./Preview";
import { ShareDialog } from "./ShareDialog";
import { useReviewPrompt } from "./trust/ReviewPrompt";
import { SplitView } from "./SplitView";
import { UpgradeDialog } from "./UpgradeDialog";
import { ViewSwitcher } from "./ViewSwitcher";
import { Welcome } from "./Welcome";
import { Wizard } from "./Wizard";
import { useT, type MessageKey } from "@/lib/i18n";

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
  const t = useT();
  const { state, update } = doc;
  const { plan, signedIn } = usePlan();
  const catalog = useCatalog();
  const [layout, setLayout] = useState<Layout>(loadLayout);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [toastState, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  const setNotice = useCallback((text: string, undo?: () => void) => setToast(text ? { text, undo } : null), []);
  const notice = toastState?.text ?? "";
  const [matching, setMatching] = useState(false);
  const [atsOpen, setAtsOpen] = useState(false);
  const [optimising, setOptimising] = useState(false);
  const [linkedin, setLinkedin] = useState(false);
  const [pages, setPages] = useState(1);
  const credits = useCredits(signedIn);
  const [gate, setGate] = useState<Gate | null>(null);
  const [sharing, setSharing] = useState(false);
  const [history, setHistory] = useState(false);
  /** A template the plan doesn't include, shown in the preview only until the user upgrades. */
  const [trial, setTrial] = useState<TemplateId | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const isDesktop = useIsDesktop();
  const reviewPrompt = useReviewPrompt(signedIn);

  // Once the plan covers the template being tried (say, after an upgrade in another tab), it is simply the template.
  const trying = trial && trial !== state.template && !isUnlocked(plan, catalog.meta(trial).tier) ? trial : null;
  const template = trying ?? state.template;
  const templateMeta = catalog.meta(template);
  const templateLocked = !isUnlocked(plan, templateMeta.tier);
  const report = useMemo(() => atsReport(state.cv, { templateAts: templateMeta.ats, pages }), [state.cv, templateMeta.ats, pages]);
  const fullReport = can(plan, "ats.fullReport");
  const assist = useMemo<AiAssist>(() => ({ enabled: signedIn, onGate: setGate, notify: setNotice }), [signedIn, setNotice]);

  useEffect(() => {
    saveLayout(layout);
  }, [layout]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setToast(null), toastState?.undo ? 6000 : 2800);
    return () => clearTimeout(t);
  }, [notice, toastState]);

  useEffect(() => {
    if (trial && trial !== state.template && isUnlocked(plan, catalog.meta(trial).tier)) update({ template: trial });
  }, [plan, trial, state.template, catalog, update]);

  const setCV = (cv: CV) => update({ cv });
  const setAccent = (accent: string | null) => update({ accent });

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
        reviewPrompt.afterDownload();
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

  // AI writes from the CV on screen; any signed-in user can use it, guests get the sign-in prompt.
  function openLinkedIn() {
    if (signedIn) setLinkedin(true);
    else setGate({ kind: "account", what: "write your LinkedIn profile" });
  }

  const actions: ExportActions = {
    exportAs: (f) => void exportAs(f),
    busy,
    locked,
    pageSize: state.pageSize,
    onPageSize: (pageSize: PageSize) => update({ pageSize }),
    templatesHref: cloud ? `/templates?resume=${cloud.resumeId}` : "/templates",
    onLinkedIn: openLinkedIn,
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

  // Bottom centre on phones (above the floating buttons), bottom inline-end on desktop.
  const toast = toastState && (
    <div className="no-print pointer-events-none fixed inset-x-0 bottom-20 z-[var(--z-toast)] flex justify-center px-4 lg:bottom-6 lg:justify-end lg:px-6">
      <div className="pointer-events-auto">
        <Toast
          action={
            toastState.undo
              ? {
                  label: "Undo",
                  onClick: () => {
                    toastState.undo?.();
                    setToast(null);
                  },
                }
              : undefined
          }
        >
          {toastState.text}
        </Toast>
      </div>
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

  const menuItem = "cvb-menu-item w-full";
  const title = cloud?.title ?? (state.cv.personal.name.trim() ? `${state.cv.personal.name.trim()}'s CV` : "Untitled CV");
  const share = () => (cloud && hasFeature(plan, "share.link") ? setSharing(true) : setGate({ kind: "feature", feature: "share.link" }));
  // Optimising writes into the account's CV, so it needs one; guests get the sign-in prompt.
  const optimise = () => {
    setAtsOpen(false);
    if (signedIn && cloud) setOptimising(true);
    else setGate({ kind: "account", what: "use AI writing" });
  };
  const atsTone = report.score >= 80 ? "success" : report.score >= 50 ? "brand" : "warning";

  return (
    <AiAssistContext.Provider value={assist}>
      <div className="no-print flex h-dvh flex-col bg-canvas">
        {/* The editor's own app bar: the blue band in light, with the CV's name, the view switch and its actions. */}
        <header className="cvb-appbar relative grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              href={signedIn ? "/app" : "/"}
              title={signedIn ? t("nav.myCvs") : "CV Builder"}
              aria-label={signedIn ? t("nav.myCvs") : "CV Builder"}
              className="grid size-9 shrink-0 place-items-center rounded-md hover:bg-appbar-hover focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
            >
              <LogoMark size={28} />
            </Link>
            <div className="hidden min-w-0 flex-col leading-tight sm:flex">
              {cloud ? <TitleField title={cloud.title} onRename={cloud.onRename} /> : <span className="truncate text-sm font-semibold text-appbar-ink">{title}</span>}
              <SaveIndicator status={doc.status} conflict={doc.conflict} />
            </div>
          </div>

          <ViewSwitcher mode={mode} onMode={setMode} allowSplit={isDesktop} />

          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="sm" icon="template" href={actions.templatesHref} className="hidden 2xl:inline-flex">
              Templates
            </Button>
            <button
              type="button"
              onClick={() => setAtsOpen(true)}
              title="ATS score: how well tracking systems read your CV"
              className="cvb-btn cvb-btn-ghost cvb-btn-sm hidden lg:inline-flex"
            >
              ATS
              <Badge tone={atsTone} pill className="cvb-num">
                <span className="cvb-sr">score </span>
                {report.score}
              </Badge>
            </button>
            <Button variant="ghost" size="sm" icon="briefcase" onClick={() => setMatching(true)} className="hidden whitespace-nowrap xl:inline-flex">
              Match job
            </Button>
            <Button variant="ghost" size="sm" icon="share" onClick={share} className="hidden md:inline-flex">
              Share
            </Button>
            {signedIn && credits.data && (
              <Button
                variant="ghost"
                size="sm"
                icon="sparkle"
                href="/pricing#credits"
                title={`${credits.data.remaining} AI credits left · resets ${new Date(credits.data.resetsAt).toLocaleDateString()}`}
                className="cvb-num hidden 2xl:inline-flex"
              >
                {credits.data.remaining}
              </Button>
            )}
            {!signedIn && (
              <Button variant="ghost" size="sm" href="/sign-up?next=/app" className="hidden whitespace-nowrap lg:inline-flex">
                <CloudIcon className="size-4" /> Save to account
              </Button>
            )}
            {!onFinish && (
              <Button
                variant="secondary"
                size="sm"
                icon={templateLocked ? "lock" : "download"}
                loading={busy === "pdf"}
                onClick={() => void exportAs("pdf")}
                className="hidden whitespace-nowrap sm:inline-flex"
              >
                <span className="hidden xl:inline">{busy === "pdf" ? t("wizard.preparingPdf") : t("wizard.downloadPdf")}</span>
                <span className="xl:hidden">PDF</span>
              </Button>
            )}
            <Dropdown
              label="More actions"
              trigger={({ toggle, ...aria }) => <IconButton icon="more" label="More actions" tooltip={false} title="More actions" onClick={toggle} {...aria} />}
            >
              {(close) => {
                const run = (fn: () => void) => () => {
                  close();
                  fn();
                };
                return (
                  <div className="cvb-menu max-h-[80dvh] w-64 overflow-y-auto" role="menu" aria-label="More actions">
                    <MenuLabel>Download</MenuLabel>
                    {(["docx", "txt"] as const).map((f) => (
                      <button key={f} type="button" role="menuitem" className={menuItem} onClick={run(() => void exportAs(f))}>
                        <Icon name="download" size={18} />
                        <span className="cvb-menu-text">{f === "docx" ? "Word document (.docx)" : "Plain text (.txt)"}</span>
                        {locked.includes(f) && <Icon name="lock" size={16} label="Needs an upgrade" />}
                      </button>
                    ))}
                    <button type="button" role="menuitem" className={menuItem} onClick={run(printPdf)}>
                      <Icon name="file" size={18} />
                      <span className="cvb-menu-text">Print or save with the browser</span>
                    </button>
                    {/* The bar restyles segmented controls for the blue band; this one sits on the menu's surface. */}
                    <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm text-ink [&_.cvb-segmented]:bg-surface-3 [&_.cvb-segmented_button]:text-ink-3 [&_[aria-pressed=true]]:!bg-surface [&_[aria-pressed=true]]:!text-ink [&_[aria-pressed=true]]:!shadow-sm">
                      Page size
                      <SegmentedControl
                        label="Page size"
                        size="sm"
                        value={state.pageSize}
                        onChange={(pageSize: PageSize) => update({ pageSize })}
                        options={(Object.keys(PAGE_SIZES) as PageSize[]).map((size) => ({ value: size, label: size === "A4" ? "A4" : "Letter" }))}
                      />
                    </div>
                    <div className="cvb-menu-sep" role="separator" />
                    <MenuLabel>CV</MenuLabel>
                    <button type="button" role="menuitem" className={menuItem} onClick={run(optimise)}>
                      <Icon name="sparkle" size={18} className="text-brand-ink" />
                      <span className="cvb-menu-text">Optimise with AI</span>
                    </button>
                    <button type="button" role="menuitem" className={menuItem} onClick={run(openLinkedIn)}>
                      <Icon name="briefcase" size={18} />
                      <span className="cvb-menu-text">LinkedIn profile</span>
                    </button>
                    <button type="button" role="menuitem" className={`${menuItem} md:hidden`} onClick={run(share)}>
                      <Icon name="share" size={18} />
                      <span className="cvb-menu-text">Share link</span>
                    </button>
                    <button type="button" role="menuitem" className={`${menuItem} xl:hidden`} onClick={run(() => setMatching(true))}>
                      <Icon name="briefcase" size={18} />
                      <span className="cvb-menu-text">Match to a job</span>
                    </button>
                    <Link href={actions.templatesHref} role="menuitem" className={`${menuItem} 2xl:hidden`} onClick={close}>
                      <Icon name="template" size={18} />
                      <span className="cvb-menu-text">All templates</span>
                    </Link>
                    <button type="button" role="menuitem" className={`${menuItem} lg:hidden`} onClick={run(() => setAtsOpen(true))}>
                      <Icon name="target" size={18} />
                      <span className="cvb-menu-text">ATS score: {report.score}</span>
                    </button>
                    {cloud && (
                      <button type="button" role="menuitem" className={menuItem} onClick={run(() => setHistory(true))}>
                        <HistoryIcon className="size-[18px] text-ink-3" />
                        <span className="cvb-menu-text">Version history</span>
                      </button>
                    )}
                    <button type="button" role="menuitem" className={menuItem} onClick={run(() => fileRef.current?.click())}>
                      <Icon name="upload" size={18} />
                      <span className="cvb-menu-text">Import backup (.json)</span>
                    </button>
                    <button type="button" role="menuitem" className={menuItem} onClick={run(() => void exportAs("json"))}>
                      <Icon name="download" size={18} />
                      <span className="cvb-menu-text">Save backup (.json)</span>
                    </button>
                    <button type="button" role="menuitem" className={menuItem} onClick={run(loadExample)}>
                      <Icon name="files" size={18} />
                      <span className="cvb-menu-text">Load example CV</span>
                    </button>
                    {isDesktop && (
                      <>
                        <div className="cvb-menu-sep" role="separator" />
                        <MenuLabel>Layout</MenuLabel>
                        <button
                          type="button"
                          role="menuitem"
                          className={menuItem}
                          onClick={run(() => setLayout((l) => ({ ...l, mode: "split", previewFirst: !l.previewFirst })))}
                        >
                          <Icon name="split" size={18} />
                          <span className="cvb-menu-text">Put preview on the {layout.previewFirst ? "right" : "left"}</span>
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className={menuItem}
                          onClick={run(() => setLayout((l) => ({ ...l, mode: "split", editorWidth: DEFAULT_EDITOR_WIDTH, zoom: "width" })))}
                        >
                          <Icon name="undo" size={18} />
                          <span className="cvb-menu-text">Reset layout</span>
                        </button>
                      </>
                    )}
                    <div className="cvb-menu-sep" role="separator" />
                    <button type="button" role="menuitem" data-danger="" className={menuItem} onClick={run(startOver)}>
                      <Icon name="trash" size={18} />
                      <span className="cvb-menu-text">{cloud ? "Clear this CV" : "Start over"}</span>
                    </button>
                  </div>
                );
              }}
            </Dropdown>
          </div>
        </header>

        {doc.conflict && (
          <Alert
            tone="warning"
            banner
            className="border-b border-line px-4 sm:px-6"
            actions={
              <>
                <Button variant="secondary" size="sm" onClick={() => doc.resolveConflict("theirs")}>
                  Load the newer version
                </Button>
                <Button variant="ghost" size="sm" onClick={() => doc.resolveConflict("mine")}>
                  Keep mine
                </Button>
              </>
            }
          >
            This CV was changed on another device while you were editing here.
          </Alert>
        )}
        {trying && (
          <Alert
            tone="highlight"
            banner
            icon="lock"
            className="border-b border-line px-4 sm:px-6"
            actions={
              <>
                <Button variant="highlight" size="sm" icon="sparkle" onClick={() => setGate({ kind: "tier", tier: templateMeta.tier, name: templateMeta.name })}>
                  Unlock it
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setTrial(null)}>
                  Back to {catalog.meta(state.template).name}
                </Button>
              </>
            }
          >
            You&apos;re previewing <strong>{templateMeta.name}</strong>, a {PLAN_LABEL[planForGate({ kind: "tier", tier: templateMeta.tier, name: "" })]} template.
          </Alert>
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
              ats={{ report, full: fullReport, onUnlock: () => setGate({ kind: "feature", feature: "ats.fullReport" }), onOptimise: optimise }}
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
              fontScale={state.fontScale}
              onFontScale={(fontScale) => update({ fontScale })}
              onPages={setPages}
              onNotice={setNotice}
              templatesHref={actions.templatesHref}
              zoom={layout.zoom}
              onZoom={setZoom}
              activeStep={STEPS[state.step]?.id}
              onEditSection={editSection}
              onSwap={isDesktop && mode === "split" ? () => setLayout((l) => ({ ...l, previewFirst: !l.previewFirst })) : undefined}
            />
          }
        />

        {isDesktop && mode === "editor" && <MiniPreview cv={state.cv} template={template} accent={state.accent} scale={state.fontScale} onOpen={() => setMode("split")} />}

        {!isDesktop &&
          (mode === "preview" ? (
            <Button
              variant="primary"
              icon="download"
              loading={busy === "pdf"}
              onClick={() => void exportAs("pdf")}
              className="fixed bottom-5 end-4 z-30 h-11 rounded-full shadow-lg"
            >
              {busy === "pdf" ? t("wizard.preparingPdf") : t("wizard.downloadPdf")}
            </Button>
          ) : (
            <Button variant="secondary" icon="eye" onClick={() => setMode("preview")} className="fixed bottom-[76px] end-4 z-30 h-11 rounded-full shadow-lg">
              {t("builder.preview")}
            </Button>
          ))}
        {!isDesktop && mode === "preview" && (
          <Button variant="secondary" icon="list" onClick={() => setMode("editor")} className="fixed bottom-5 start-4 z-30 h-11 rounded-full shadow-lg">
            Edit
          </Button>
        )}
      </div>

      {/* The only thing that prints: a clean copy of the CV. */}
      <div className="print-only">
        {state.pageSize === "LETTER" && <style>{"@page{size:letter}"}</style>}
        <div className="paper" data-size={paperSizeAttr(state.pageSize)}>
          <CVDocument cv={state.cv} template={template} accent={state.accent} scale={state.fontScale} />
        </div>
      </div>

      <UpgradeDialog gate={gate} onClose={() => setGate(null)} />
      <MatchDialog
        open={matching}
        onClose={() => setMatching(false)}
        cv={state.cv}
        resumeId={cloud?.resumeId}
        flush={doc.flush}
        onCv={(cv) => {
          const before = state.cv;
          setCV(cv);
          setNotice("Keyword added to your skills", () => setCV(before));
        }}
        onGate={(g) => {
          setMatching(false);
          setGate(g);
        }}
      />
      <Dialog open={atsOpen} onClose={() => setAtsOpen(false)} title="ATS score and report" size="lg">
        <AtsPanel
          inDialog
          report={report}
          full={fullReport}
          onOptimise={optimise}
          onFix={(step) => {
            setAtsOpen(false);
            editSection(step);
          }}
          onUnlock={() => {
            setAtsOpen(false);
            setGate({ kind: "feature", feature: "ats.fullReport" });
          }}
        />
      </Dialog>
      {optimising && (
        <OptimiseDialog
          open
          onClose={() => setOptimising(false)}
          cv={state.cv}
          score={(cv) => atsReport(cv, { templateAts: templateMeta.ats, pages }).score}
          creditsLeft={credits.data?.remaining}
          onGate={setGate}
          onApply={(next, count) => {
            const before = state.cv;
            setCV(next);
            setNotice(`${count} AI ${count === 1 ? "change" : "changes"} applied`, () => setCV(before));
          }}
        />
      )}
      {linkedin && <LinkedInDialog open onClose={() => setLinkedin(false)} cv={state.cv} creditsLeft={credits.data?.remaining} onGate={setGate} />}
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
      {reviewPrompt.element}
    </AiAssistContext.Provider>
  );
}

function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="cvb-overline cvb-menu-label">{children}</div>;
}

const STATUS: Record<SaveStatus, { text: MessageKey; icon: string; spin?: boolean }> = {
  local: { text: "builder.saveLocal", icon: "check" },
  saving: { text: "builder.saving", icon: "clock", spin: true },
  saved: { text: "builder.saved", icon: "check" },
  offline: { text: "builder.offline", icon: "x-circle" },
  error: { text: "builder.saveError", icon: "alert-triangle" },
};

function SaveIndicator({ status, conflict }: { status: SaveStatus; conflict: boolean }) {
  const t = useT();
  const k = conflict ? { text: "builder.conflict" as MessageKey, icon: "alert-triangle", spin: false } : STATUS[status];
  return (
    <span className="flex items-center gap-1 text-xs text-appbar-ink-2" role="status" aria-live="polite">
      <Icon name={k.icon} size={14} className={k.spin ? "motion-safe:animate-pulse" : undefined} /> {t(k.text)}
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
        className="-mx-1 truncate rounded-xs px-1 text-start text-sm font-semibold text-appbar-ink hover:bg-appbar-hover focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
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
      className="-mx-1 w-56 rounded-xs bg-appbar-hover px-1 text-sm font-semibold text-appbar-ink outline-none ring-2 ring-appbar-ink"
    />
  );
}
