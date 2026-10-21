/** How the workspace is arranged: which panes show, how wide they are, and the preview zoom. */

export type ViewMode = "editor" | "split" | "preview";

/** "width" fits the page to the pane width, "page" fits a whole page in view, a number is a fixed scale. */
export type Zoom = "width" | "page" | number;

export type Layout = {
  mode: ViewMode;
  /** Width of the editor pane in split view, in CSS pixels. */
  editorWidth: number;
  /** Puts the preview on the left and the editor on the right. */
  previewFirst: boolean;
  zoom: Zoom;
};

export const DEFAULT_EDITOR_WIDTH = 700;
export const MIN_EDITOR = 380;
export const MIN_PREVIEW = 360;
/** Dragging a pane narrower than this (past its minimum) hides it on release. */
export const COLLAPSE_EDITOR = 300;
export const COLLAPSE_PREVIEW = 280;

export const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5];

export const DEFAULT_LAYOUT: Layout = {
  mode: "split",
  editorWidth: DEFAULT_EDITOR_WIDTH,
  previewFirst: false,
  zoom: "width",
};

export const VIEW_MODES: { id: ViewMode; label: string; shortcut: string }[] = [
  { id: "editor", label: "Edit", shortcut: "Alt+1" },
  { id: "split", label: "Split", shortcut: "Alt+2" },
  { id: "preview", label: "Preview", shortcut: "Alt+3" },
];

const STORAGE_KEY = "cv-builder:layout:v2";

export function loadLayout(): Layout {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const o = JSON.parse(raw) as Partial<Record<keyof Layout, unknown>>;
    const mode = VIEW_MODES.some((m) => m.id === o.mode) ? (o.mode as ViewMode) : DEFAULT_LAYOUT.mode;
    const editorWidth =
      typeof o.editorWidth === "number" && Number.isFinite(o.editorWidth)
        ? Math.max(MIN_EDITOR, Math.round(o.editorWidth))
        : DEFAULT_EDITOR_WIDTH;
    const zoom: Zoom =
      o.zoom === "width" || o.zoom === "page"
        ? o.zoom
        : typeof o.zoom === "number" && o.zoom >= 0.25 && o.zoom <= 3
          ? o.zoom
          : DEFAULT_LAYOUT.zoom;
    return { mode, editorWidth, previewFirst: o.previewFirst === true, zoom };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function saveLayout(layout: Layout): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Storage can be unavailable; the layout just won't be remembered.
  }
}

/** Next zoom step in a direction, starting from the scale currently on screen. */
export function stepZoom(current: number, dir: 1 | -1): number {
  if (dir > 0) return ZOOM_STEPS.find((z) => z > current + 0.005) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1];
  return [...ZOOM_STEPS].reverse().find((z) => z < current - 0.005) ?? ZOOM_STEPS[0];
}
