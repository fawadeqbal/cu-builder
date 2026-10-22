"use client";

import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { stepZoom, type Zoom } from "@/lib/layout";
import { PAGE_SIZES, paperSizeAttr, type PageSize } from "@/lib/page";
import type { StepId } from "@/lib/steps";
import type { CV } from "@cvb/domain";
import type { TemplateId } from "@cvb/templates/catalog";
import { CVDocument } from "@cvb/templates";
import { TemplatePicker } from "./TemplatePicker";
import { Button, FitPageIcon, FitWidthIcon, Icon, IconButton } from "@cvb/ui";

const PRINT_MARGIN_MM = 10 + 12; // top + bottom @page margin in globals.css
const PAD = 24; // space around the sheet inside the pane
const MIN_SCALE = 0.3;
const MIN_FONT_SCALE = 0.8;
const MAX_SCALE = 2;

type Props = {
  cv: CV;
  template: TemplateId;
  onTemplate: (t: TemplateId) => void;
  accent: string | null;
  onAccent: (a: string | null) => void;
  pageSize: PageSize;
  /** "Fit to one page" type scale (1 = template size). */
  fontScale: number;
  onFontScale: (scale: number) => void;
  /** Reports the page count whenever it changes. */
  onPages?: (pages: number) => void;
  onNotice?: (text: string, undo?: () => void) => void;
  templatesHref: string;
  zoom: Zoom;
  onZoom: (z: Zoom) => void;
  /** The wizard step being edited: its section is highlighted and scrolled into view. */
  activeStep?: StepId;
  /** Clicking a section of the CV jumps to the step that edits it. */
  onEditSection?: (step: StepId) => void;
  onSwap?: () => void;
};

type Metrics = { paperW: number; paperH: number; fitWidth: number; fitPage: number; pages: number };

const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

/** The live A4 preview with its toolbar: template, zoom and page count. */
export function Preview({
  cv,
  template,
  onTemplate,
  accent,
  onAccent,
  pageSize,
  fontScale,
  onFontScale,
  onPages,
  onNotice,
  templatesHref,
  zoom,
  onZoom,
  activeStep,
  onEditSection,
  onSwap,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [m, setM] = useState<Metrics>({ paperW: 0, paperH: 0, fitWidth: 1, fitPage: 1, pages: 1 });

  const scale = zoom === "width" ? m.fitWidth : zoom === "page" ? m.fitPage : zoom;
  const scaleRef = useRef(scale);
  const onPagesRef = useRef(onPages);
  useEffect(() => {
    onPagesRef.current = onPages;
  }, [onPages]);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    const paper = paperRef.current;
    if (!scroll || !paper) return;

    const measure = () => {
      const paperW = paper.offsetWidth;
      const paperH = paper.offsetHeight;
      if (!paperW) return;
      const availW = Math.max(120, scroll.clientWidth - PAD * 2);
      const availH = Math.max(120, scroll.clientHeight - PAD * 2);
      const { w, h } = PAGE_SIZES[pageSize];
      const pxPerMm = paperW / w;
      const contentMm = paperH / pxPerMm - PRINT_MARGIN_MM;
      const pages = Math.max(1, Math.ceil(contentMm / (h - PRINT_MARGIN_MM) - 0.02));
      setM({
        paperW,
        paperH,
        fitWidth: Math.min(1, availW / paperW),
        fitPage: Math.min(1, availW / paperW, availH / (h * pxPerMm)),
        pages,
      });
      onPagesRef.current?.(pages);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroll);
    observer.observe(paper);
    return () => observer.disconnect();
  }, [pageSize]);

  // Ctrl/⌘ + wheel (and trackpad pinch) zooms the sheet instead of the whole page.
  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      onZoom(Math.round(clampScale(scaleRef.current * Math.exp(-e.deltaY * 0.01)) * 100) / 100);
    };
    scroll.addEventListener("wheel", onWheel, { passive: false });
    return () => scroll.removeEventListener("wheel", onWheel);
  }, [onZoom]);

  // Follow the wizard: bring the section being edited into view.
  useEffect(() => {
    const scroll = scrollRef.current;
    const frame = frameRef.current;
    if (!scroll || !frame || !activeStep || activeStep === "finish" || !m.paperW) return;
    const target = frame.querySelector<HTMLElement>(`[data-step="${activeStep}"]`);
    if (!target) return;
    const top = target.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop;
    const bottom = top + target.getBoundingClientRect().height;
    const visible = top >= scroll.scrollTop && bottom <= scroll.scrollTop + scroll.clientHeight;
    if (!visible) scroll.scrollTo({ top: Math.max(0, top - PAD * 2), behavior: "smooth" });
    // Only when the step changes, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, m.paperW > 0]);

  /**
   * "Fit to one page": tries type sizes from 100% down to 80% on the live sheet (no re-render
   * per step) and keeps the largest that fits on one page.
   */
  function fitToPage() {
    const paper = paperRef.current;
    const doc = paper?.querySelector<HTMLElement>(".cv-doc");
    if (!paper || !doc) return;
    const { w, h } = PAGE_SIZES[pageSize];
    const previous = doc.style.zoom;
    // The sheet has a minimum height of one page, so it fits when it hasn't grown past it.
    const fits = () => paper.offsetHeight / (paper.offsetWidth / w) <= h + 0.3;
    let best: number | null = null;
    for (let s = 1; s >= MIN_FONT_SCALE - 0.001; s = Math.round((s - 0.02) * 100) / 100) {
      doc.style.zoom = String(s);
      if (fits()) {
        best = s;
        break;
      }
    }
    doc.style.zoom = previous;
    const before = fontScale;
    if (best === null) {
      onNotice?.("Still longer than one page at the smallest size. Shorten older entries or the summary.");
      return;
    }
    onFontScale(best);
    onNotice?.(best === 1 ? "It already fits on one page" : `Fits on one page at ${Math.round(best * 100)}% text size`, best === before ? undefined : () => onFontScale(before));
  }

  function onPaperClick(e: MouseEvent<HTMLDivElement>) {
    if (!onEditSection) return;
    const el = e.target as HTMLElement;
    // Links in the CV would navigate away from the builder; while editing, a click means "edit this".
    if (el.closest("a")) e.preventDefault();
    const section = el.closest<HTMLElement>("[data-step]");
    if (section?.dataset.step) onEditSection(section.dataset.step as StepId);
  }

  // A pressed fit button shows as selected; IconButton passes aria-pressed through.
  const fitBtn = (active: boolean) => (active ? "!bg-brand-soft !text-ink" : "");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="@container flex h-12 shrink-0 items-center gap-2 border-b border-line bg-surface px-3">
        <span className="cvb-badge hidden shrink-0 @md:inline-flex">
          <Icon name="file" size={14} />
          <span className="cvb-num">{m.pages}</span> {m.pages === 1 ? "page" : "pages"}
          <span className="text-ink-3">· {PAGE_SIZES[pageSize].label}</span>
        </span>
        {(m.pages > 1 || fontScale !== 1) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={fontScale !== 1 && m.pages === 1 ? () => onFontScale(1) : fitToPage}
            title={fontScale !== 1 ? `Text at ${Math.round(fontScale * 100)}%` : "Shrink spacing and text slightly so the CV fits on one page"}
            className="hidden shrink-0 @md:inline-flex"
          >
            {fontScale !== 1 && m.pages === 1 ? `Reset size (${Math.round(fontScale * 100)}%)` : "Fit to one page"}
          </Button>
        )}

        <div className="@md:ms-auto">
          <TemplatePicker template={template} accent={accent} onTemplate={onTemplate} onAccent={onAccent} templatesHref={templatesHref} />
        </div>

        <div className="ms-auto flex items-center gap-0.5">
          <IconButton icon="minus" size="sm" label="Zoom out" disabled={scale <= MIN_SCALE + 0.01} onClick={() => onZoom(clampScale(stepZoom(scale, -1)))} />
          <button
            type="button"
            title="Reset to fit width"
            onClick={() => onZoom("width")}
            className="cvb-btn cvb-btn-ghost cvb-btn-sm w-14 justify-center px-0 font-mono text-xs"
          >
            {Math.round(scale * 100)}%
          </button>
          <IconButton icon="plus" size="sm" label="Zoom in" disabled={scale >= MAX_SCALE - 0.01} onClick={() => onZoom(clampScale(stepZoom(scale, 1)))} />
          <span className="mx-1 hidden h-4 w-px bg-line @sm:block" aria-hidden="true" />
          <span className="hidden items-center gap-0.5 @sm:flex">
            <ToolButton label="Fit width" pressed={zoom === "width"} className={fitBtn(zoom === "width")} onClick={() => onZoom("width")}>
              <FitWidthIcon className="size-4" />
            </ToolButton>
            <ToolButton label="Fit whole page" pressed={zoom === "page"} className={fitBtn(zoom === "page")} onClick={() => onZoom("page")}>
              <FitPageIcon className="size-4" />
            </ToolButton>
          </span>
          {onSwap && (
            <>
              <span className="mx-1 h-4 w-px bg-line" aria-hidden="true" />
              <IconButton icon="sort" size="sm" label="Swap editor and preview sides" onClick={onSwap} />
            </>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="preview-canvas relative min-h-0 flex-1 overflow-auto" style={{ padding: PAD }}>
        <div
          ref={frameRef}
          className="relative mx-auto transition-opacity duration-200"
          style={{
            width: m.paperW ? m.paperW * scale : undefined,
            height: m.paperH ? m.paperH * scale : undefined,
            opacity: m.paperW ? 1 : 0,
          }}
        >
          <div className="absolute start-0 top-0 origin-top-left rtl:origin-top-right" style={{ transform: `scale(${scale})` }}>
            {activeStep && onEditSection && (
              <style>{`.preview-live [data-step="${activeStep}"]{box-shadow:inset 0 0 0 100vmax color-mix(in srgb, var(--brand) 4.5%, transparent),0 0 0 3pt color-mix(in srgb, var(--brand) 4.5%, transparent)}`}</style>
            )}
            <div
              ref={paperRef}
              className={`paper${onEditSection ? " preview-live" : ""}`}
              data-size={paperSizeAttr(pageSize)}
              onClick={onPaperClick}
            >
              <CVDocument cv={cv} template={template} accent={accent} scale={fontScale} />
            </div>
            {/* Where pages break, roughly: printing and the PDF cut at the nearest clean gap above. */}
            {m.paperW > 0 &&
              Array.from({ length: m.pages - 1 }, (_, i) => {
                const pxPerMm = m.paperW / PAGE_SIZES[pageSize].w;
                const top = (10 + (i + 1) * (PAGE_SIZES[pageSize].h - PRINT_MARGIN_MM)) * pxPerMm;
                return (
                  <div key={i} aria-hidden="true" className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-danger/80" style={{ top }}>
                    <span className="absolute -top-2.5 end-2 rounded-xs bg-danger-soft px-1.5 text-[10px] font-semibold text-danger">Page {i + 2}</span>
                  </div>
                );
              })}
          </div>
        </div>
        {onEditSection && (
          <p className="cvb-caption mt-4 text-center">Click any part of your CV to edit it</p>
        )}
      </div>
    </div>
  );
}

/** A small live thumbnail of the first page, used as a shortcut back to the preview. */
export function MiniPreview({ cv, template, accent, scale = 1, onOpen }: { cv: CV; template: TemplateId; accent: string | null; scale?: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Show preview (Alt+2)"
      className="group fixed bottom-24 end-6 z-30 hidden w-[150px] overflow-hidden rounded-lg border border-line bg-surface text-start shadow-md transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none lg:block"
    >
      <div aria-hidden="true" className="preview-canvas relative h-[176px] overflow-hidden">
        <div className="absolute start-2 top-2 w-[210mm] origin-top-left scale-[0.168] rtl:origin-top-right">
          <div className="paper">
            <CVDocument cv={cv} template={template} accent={accent} scale={scale} />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-line px-2.5 py-1.5 text-xs font-semibold text-ink-2">
        Live preview
        <Icon name="arrow-right" size={14} className="text-ink-3 transition group-hover:text-brand-ink" />
      </div>
    </button>
  );
}

/** A small toolbar toggle with a custom icon (IconButton only takes Folio icon names). */
function ToolButton({ label, pressed, className, onClick, children }: { label: string; pressed: boolean; className?: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} aria-pressed={pressed} onClick={onClick} className={`cvb-btn cvb-btn-ghost cvb-btn-sm cvb-btn-icon ${className ?? ""}`}>
      {children}
    </button>
  );
}
