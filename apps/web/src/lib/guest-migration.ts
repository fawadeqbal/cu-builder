"use client";

import type { ResumeDto } from "@cvb/contracts";
import { api, isApiError } from "./api";
import { clearSaved, hasContent, loadSaved } from "./cv";

export type MigrationResult =
  | { kind: "none" }
  | { kind: "moved"; resume: ResumeDto }
  /** The plan's CV limit is reached; the browser copy is kept so nothing is lost. */
  | { kind: "blocked" };

let running: Promise<MigrationResult> | null = null;

/**
 * Moves the CV a guest built in this browser into their account, once, right after they sign
 * in. Template, colour and page size come along unchanged. The browser copy is removed only
 * after the server has stored it.
 */
export function migrateGuestCv(): Promise<MigrationResult> {
  running ??= (async (): Promise<MigrationResult> => {
    const saved = loadSaved();
    if (!hasContent(saved)) return { kind: "none" };
    const name = saved.cv.personal.name.trim();
    try {
      const resume = await api.post<ResumeDto>("/resumes", {
        title: name ? `${name}'s CV` : "My CV",
        templateId: saved.template,
        accent: saved.accent,
        pageSize: saved.pageSize,
        data: saved.cv,
      });
      clearSaved();
      return { kind: "moved", resume };
    } catch (e) {
      if (isApiError(e, "PLAN_REQUIRED")) return { kind: "blocked" };
      throw e;
    }
  })().finally(() => {
    running = null;
  });
  return running;
}

/** Throw away the browser copy (after the user chose not to keep it). */
export const discardGuestCv = clearSaved;
