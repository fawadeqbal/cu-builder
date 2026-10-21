import { normalizeCV, type CV } from "@cvb/domain";
import { isAccent, isTemplateId, type TemplateId } from "@cvb/templates/catalog";

/**
 * Browser storage for the CV being edited. Replaced by the API client once accounts exist
 * (Phase 1); components depend on these functions only, so the swap stays local.
 */
const STORAGE_KEY = "cv-builder:v1";

export type Saved = {
  cv: CV;
  template: TemplateId;
  /** Accent colour chosen for the CV, or null for the template's own. */
  accent: string | null;
  /** Index of the wizard step the user is on. */
  step: number;
  /** False until the user leaves the welcome screen. */
  started: boolean;
};

export function loadSaved(): Saved | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { cv?: unknown; template?: unknown; accent?: unknown; step?: unknown; started?: unknown };
    const template: TemplateId = isTemplateId(parsed.template) ? parsed.template : "classic";
    const accent = isAccent(parsed.accent) ? parsed.accent : null;
    const step = typeof parsed.step === "number" && parsed.step >= 0 ? Math.floor(parsed.step) : 0;
    // Data saved before the wizard existed has no "started" flag: treat it as started.
    const started = parsed.started === undefined ? true : parsed.started === true;
    return { cv: normalizeCV(parsed.cv), template, accent, step, started };
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
