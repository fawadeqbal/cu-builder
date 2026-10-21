"use client";

import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { stepZoom, type Zoom } from "@/lib/layout";
import type { StepId } from "@/lib/steps";
import type { CV, TemplateId } from "@/lib/types";
import { CVDocument } from "@/templates";
import { TemplatePicker } from "./TemplatePicker";
import { FitPageIcon, FitWidthIcon, MinusIcon, PlusIcon, SwapIcon } from "./icons";

const PAGE_MM = 297;
const PRINT_MARGIN_MM = 10 + 12; // top + bottom @page margin in globals.css
const PAD = 24; // space around the sheet inside the pane
const MIN_SCALE = 0.3;
const MAX_SCALE = 2;

type Props = {
  cv: CV;
  template: TemplateId;
  onTemplate: (t: TemplateId) => void;
  accent: string | null;
  onAccent: (a: string | null) => void;
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
export function Preview({ cv, template, onTemplate, accent, onAccent, zoom, onZoom, activeStep, onEditSection, onSwap }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [m, setM] = useState<Metrics>({ paperW: 0, paperH: 0, fitWidth: 1, fitPage: 1, pages: 1 });

  const scale = zoom === "width" ? m.fitWidth : zoom === "page" ? m.fitPage : zoom;
  const scaleRef = useRef(scale);
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
      const pageH = (paperW * PAGE_MM) / 210;
      const availW = Math.max(120, scroll.clientWidth - PAD * 2);
      const availH = Math.max(120, scroll.clientHeight - PAD * 2);
      const pxPerMm = paperW / 210;
      const contentMm = paperH / pxPerMm - PRINT_MARGIN_MM;
      setM({
        paperW,
        paperH,
        fitWidth: Math.min(1, availW / paperW),
        fitPage: Math.min(1, availW / paperW, availH / pageH),
        pages: Math.max(1, Math.ceil(contentMm / (PAGE_MM - PRINT_MARGIN_MM) - 0.02)),
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroll);
    observer.observe(paper);
    return () => observer.disconnect();
  }, []);

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

  function onPaperClick(e: MouseEvent<HTMLDivElement>) {
    if (!onEditSection) return;
    const el = e.target as HTMLElement;
    // Links in the CV would navigate away from the builder; while editing, a click means "edit this".
    if (el.closest("a")) e.preventDefault();
    const section = el.closest<HTMLElement>("[data-step]");
    if (section?.dataset.step) onEditSection(section.dataset.step as StepId);
  }

  const btn =
    "grid size-7 place-items-center rounded-md text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 disabled:opacity-35 disabled:hover:bg-transparent";
  const fitBtn = (active: boolean) =>
    `${btn} ${active ? "bg-brand/10 !text-brand hover:bg-brand/15" : ""}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="@container flex h-12 shrink-0 items-center gap-2 border-b border-stone-200 bg-white/85 px-3 backdrop-blur">
        <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600 @md:flex">
          <span className="tabular-nums">{m.pages}</span> {m.pages === 1 ? "page" : "pages"}
          <span className="text-stone-400">· A4</span>
        </span>

        <div className="@md:ml-auto">
          <TemplatePicker template={template} accent={accent} onTemplate={onTemplate} onAccent={onAccent} />
        </div>

        <div className="ml-auto flex items-center gap-0.5">
          <button type="button" className={btn} title="Zoom out" aria-label="Zoom out" disabled={scale <= MIN_SCALE + 0.01} onClick={() => onZoom(clampScale(stepZoom(scale, -1)))}>
            <MinusIcon className="size-4" />
          </button>
          <button
            type="button"
            title="Reset to fit width"
            onClick={() => onZoom("width")}
            className="w-12 rounded-md py-1 text-center text-xs font-medium tabular-nums text-stone-700 hover:bg-stone-100"
          >
            {Math.round(scale * 100)}%
          </button>
          <button type="button" className={btn} title="Zoom in" aria-label="Zoom in" disabled={scale >= MAX_SCALE - 0.01} onClick={() => onZoom(clampScale(stepZoom(scale, 1)))}>
            <PlusIcon className="size-4" />
          </button>
          <span className="mx-1 hidden h-4 w-px bg-stone-200 @sm:block" />
          <button type="button" className={`${fitBtn(zoom === "width")} hidden @sm:grid`} title="Fit width" aria-label="Fit width" aria-pressed={zoom === "width"} onClick={() => onZoom("width")}>
            <FitWidthIcon className="size-4" />
          </button>
          <button type="button" className={`${fitBtn(zoom === "page")} hidden @sm:grid`} title="Fit whole page" aria-label="Fit whole page" aria-pressed={zoom === "page"} onClick={() => onZoom("page")}>
            <FitPageIcon className="size-4" />
          </button>
          {onSwap && (
            <>
              <span className="mx-1 h-4 w-px bg-stone-200" />
              <button type="button" className={btn} title="Swap sides" aria-label="Swap editor and preview sides" onClick={onSwap}>
                <SwapIcon className="size-4" />
              </button>
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
          <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${scale})` }}>
            {activeStep && onEditSection && (
              <style>{`.preview-live [data-step="${activeStep}"]{box-shadow:inset 0 0 0 100vmax rgb(30 75 143 / 0.045),0 0 0 3pt rgb(30 75 143 / 0.045)}`}</style>
            )}
            <div
              ref={paperRef}
              className={`paper${onEditSection ? " preview-live" : ""}`}
              onClick={onPaperClick}
            >
              <CVDocument cv={cv} template={template} accent={accent} />
            </div>
          </div>
        </div>
        {onEditSection && (
          <p className="mt-4 text-center text-xs text-stone-400">Click any part of your CV to edit it</p>
        )}
      </div>
    </div>
  );
}

/** A small live thumbnail of the first page, used as a shortcut back to the preview. */
export function MiniPreview({ cv, template, accent, onOpen }: { cv: CV; template: TemplateId; accent: string | null; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Show preview (Alt+2)"
      className="group fixed bottom-24 right-6 z-30 hidden w-[150px] overflow-hidden rounded-xl bg-white text-left shadow-xl ring-1 ring-stone-900/10 transition hover:-translate-y-0.5 hover:shadow-2xl lg:block"
    >
      <div aria-hidden="true" className="relative h-[176px] overflow-hidden bg-stone-100">
        <div className="absolute left-2 top-2 w-[210mm] origin-top-left scale-[0.168]">
          <div className="paper">
            <CVDocument cv={cv} template={template} accent={accent} />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-700">
        Live preview
        <span className="text-stone-400 transition group-hover:translate-x-0.5 group-hover:text-brand">→</span>
      </div>
    </button>
  );
}
