"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import {
  COLLAPSE_EDITOR,
  COLLAPSE_PREVIEW,
  DEFAULT_EDITOR_WIDTH,
  MIN_EDITOR,
  MIN_PREVIEW,
  type ViewMode,
} from "@/lib/layout";

type Props = {
  mode: ViewMode;
  editorWidth: number;
  previewFirst: boolean;
  onResize: (width: number) => void;
  onMode: (mode: ViewMode) => void;
  editor: ReactNode;
  preview: ReactNode;
};

type Hint = null | "hide-editor" | "hide-preview";

const SNAP = 14;

/**
 * Editor and preview side by side with a draggable divider.
 * Drag snaps to the default width and to the middle; dragging a pane past its minimum
 * hides it on release, which switches to the single-pane view.
 */
export function SplitView({ mode, editorWidth, previewFirst, onResize, onMode, editor, preview }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [rootW, setRootW] = useState(0);
  const [drag, setDrag] = useState<{ width: number; hint: Hint } | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(() => setRootW(root.clientWidth));
    observer.observe(root);
    setRootW(root.clientWidth);
    return () => observer.disconnect();
  }, []);

  const maxEditor = Math.max(MIN_EDITOR, rootW - MIN_PREVIEW);
  const clamp = (w: number) => Math.min(maxEditor, Math.max(MIN_EDITOR, w));
  const width = drag ? drag.width : clamp(editorWidth);

  /** The editor's side on screen: the row mirrors in right-to-left, and "preview first" swaps it again. */
  function editorOnLeft() {
    const rtl = rootRef.current ? getComputedStyle(rootRef.current).direction === "rtl" : false;
    return rtl ? previewFirst : !previewFirst;
  }

  function widthAt(clientX: number): { width: number; hint: Hint } {
    const rect = rootRef.current!.getBoundingClientRect();
    let raw = editorOnLeft() ? clientX - rect.left : rect.right - clientX;
    for (const target of [DEFAULT_EDITOR_WIDTH, rect.width / 2]) {
      if (Math.abs(raw - target) < SNAP) raw = target;
    }
    const hint: Hint =
      raw < COLLAPSE_EDITOR ? "hide-editor" : rect.width - raw < COLLAPSE_PREVIEW ? "hide-preview" : null;
    return { width: clamp(raw), hint };
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag(widthAt(e.clientX));
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    setDrag(widthAt(e.clientX));
  }

  function onPointerUp() {
    if (!drag) return;
    if (drag.hint === "hide-editor") onMode("preview");
    else if (drag.hint === "hide-preview") onMode("editor");
    else onResize(Math.round(drag.width));
    setDrag(null);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const dir = editorOnLeft() ? 1 : -1;
    const step = e.shiftKey ? 80 : 24;
    if (e.key === "ArrowLeft") onResize(clamp(width - step * dir));
    else if (e.key === "ArrowRight") onResize(clamp(width + step * dir));
    else if (e.key === "Home") onResize(MIN_EDITOR);
    else if (e.key === "End") onResize(maxEditor);
    else if (e.key === "Enter") onResize(DEFAULT_EDITOR_WIDTH);
    else return;
    e.preventDefault();
  }

  const split = mode === "split";
  const editorStyle = {
    width: split ? width : mode === "editor" ? "100%" : 0,
  };
  const animate = drag ? "" : "transition-[width] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]";
  const ratio = rootW ? Math.round((width / rootW) * 100) : 0;

  return (
    <div
      ref={rootRef}
      className={`relative flex min-h-0 flex-1 ${previewFirst ? "flex-row-reverse" : "flex-row"} ${drag ? "cursor-col-resize select-none" : ""}`}
    >
      <div
        className={`relative min-h-0 shrink-0 overflow-hidden bg-canvas ${animate}`}
        style={editorStyle}
        inert={mode === "preview"}
        aria-hidden={mode === "preview" || undefined}
      >
        {/* Fixed minimum so the form slides out instead of squashing while the pane animates. */}
        <div className="flex h-full min-w-[min(100vw,380px)] flex-col">{editor}</div>
        {drag?.hint === "hide-editor" && <CollapseHint label="Release to hide the editor" />}
      </div>

      {split && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize editor and preview"
          aria-valuemin={MIN_EDITOR}
          aria-valuemax={maxEditor}
          aria-valuenow={Math.round(width)}
          tabIndex={0}
          title="Drag to resize · double-click to reset"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setDrag(null)}
          onDoubleClick={() => onResize(DEFAULT_EDITOR_WIDTH)}
          onKeyDown={onKeyDown}
          className="group relative z-20 -mx-1.5 w-3 shrink-0 cursor-col-resize touch-none outline-none"
        >
          <span
            className={`absolute inset-x-0 inset-y-0 mx-auto w-px transition-colors ${
              drag ? "bg-brand" : "bg-line group-hover:bg-brand group-focus-visible:bg-brand"
            }`}
          />
          <span
            className={`absolute inset-x-0 inset-y-0 m-auto flex h-9 w-2 flex-col items-center justify-center gap-[3px] rounded-full bg-surface shadow-sm ring-1 transition ${
              drag ? "ring-brand" : "ring-line-control group-hover:ring-brand group-focus-visible:ring-brand"
            }`}
          >
            <i className="block size-[2px] rounded-full bg-ink-3" />
            <i className="block size-[2px] rounded-full bg-ink-3" />
            <i className="block size-[2px] rounded-full bg-ink-3" />
          </span>
          {drag && !drag.hint && (
            <span className="absolute inset-x-0 top-1/2 mt-7 flex justify-center">
              <span className="whitespace-nowrap rounded-sm bg-ink px-2 py-1 font-mono text-xs text-surface shadow-md">
                {ratio}% · {100 - ratio}%
              </span>
            </span>
          )}
        </div>
      )}

      <div
        className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-canvas"
        inert={mode === "editor"}
        aria-hidden={mode === "editor" || undefined}
      >
        {preview}
        {drag?.hint === "hide-preview" && <CollapseHint label="Release to hide the preview" />}
      </div>
    </div>
  );
}

function CollapseHint({ label }: { label: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-brand-soft/80 backdrop-blur-[2px]">
      <span className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-surface shadow-md">{label}</span>
    </div>
  );
}
