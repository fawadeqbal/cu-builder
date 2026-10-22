import { emptyCV, normalizeCV, type CV } from "@cvb/domain";
import { isAccent, isTemplateId, type TemplateId } from "@cvb/templates/catalog";
import { isPageSize, type PageSize } from "./page";

/**
 * Browser storage for a guest's CV (people can build without an account). Once they sign in,
 * the CV moves to their account (see guest-migration.ts) and the cloud copy is the one edited.
 */
const STORAGE_KEY = "cv-builder:v1";

export type Saved = {
  cv: CV;
  template: TemplateId;
  /** Accent colour chosen for the CV, or null for the template's own. */
  accent: string | null;
  pageSize: PageSize;
  /** Type size multiplier set by "Fit to one page" (1 = the template's own size). */
  fontScale: number;
  /** Index of the wizard step the user is on. */
  step: number;
  /** False until the user leaves the welcome screen. */
  started: boolean;
};

export const FRESH: Saved = { cv: emptyCV, template: "classic", accent: null, pageSize: "A4", fontScale: 1, step: 0, started: false };

export function loadSaved(): Saved | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const template: TemplateId = isTemplateId(parsed.template) ? parsed.template : "classic";
    const accent = isAccent(parsed.accent) ? parsed.accent : null;
    const pageSize = isPageSize(parsed.pageSize) ? parsed.pageSize : "A4";
    const fontScale = typeof parsed.fontScale === "number" && parsed.fontScale >= 0.7 && parsed.fontScale <= 1.15 ? parsed.fontScale : 1;
    const step = typeof parsed.step === "number" && parsed.step >= 0 ? Math.floor(parsed.step) : 0;
    // Data saved before the wizard existed has no "started" flag: treat it as started.
    const started = parsed.started === undefined ? true : parsed.started === true;
    return { cv: normalizeCV(parsed.cv), template, accent, pageSize, fontScale, step, started };
  } catch {
    return null;
  }
}

export function save(state: Saved): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable (private mode, blocked); the app still works without it.
  }
}

export function clearSaved(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** True when the guest has typed anything worth keeping. */
export const hasContent = (s: Saved | null): s is Saved =>
  !!s && s.started && (s.cv.personal.name.trim() !== "" || s.cv.experience.length > 0 || s.cv.summary.trim() !== "");

/** A file-name-safe version of the CV owner's name. */
export const fileSlug = (cv: CV) =>
  (cv.personal.name.trim() || "my").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "my";
