"use client";

import type { ResumeDto } from "@cvb/contracts";
import type { CV } from "@cvb/domain";
import type { TemplateId } from "@cvb/templates/catalog";
import { api, isApiError } from "./api";
import { FRESH, hasContent, loadSaved, save } from "./cv";

/**
 * Hands a CV from a public page (an example, the ATS checker) to the editor. Guests get it in
 * this browser's builder (/builder); signed-in people get a new CV in their account. After a
 * guest signs up, /app moves the browser copy into the account (guest-migration.ts).
 */

export type Handoff = { cv: CV; template?: TemplateId; accent?: string | null };

export type HandoffResult =
  /** Go here next. */
  | { kind: "open"; href: string }
  /** The visitor kept the CV they already had in the browser. */
  | { kind: "cancelled" }
  /** Their plan's CV limit is reached (signed in). */
  | { kind: "limit" };

/** Puts the CV into the guest builder's storage, asking first if it would replace one. */
export function saveForGuest({ cv, template = "classic", accent = null }: Handoff, confirmReplace = true): boolean {
  if (confirmReplace && hasContent(loadSaved()) && !window.confirm("Replace the CV you started in this browser with this one?")) return false;
  save({ ...FRESH, cv, template, accent, started: true, step: 0 });
  return true;
}

export async function openInEditor(h: Handoff, signedIn: boolean): Promise<HandoffResult> {
  if (!signedIn) return saveForGuest(h) ? { kind: "open", href: "/builder" } : { kind: "cancelled" };
  const name = h.cv.personal.name.trim();
  try {
    const resume = await api.post<ResumeDto>("/resumes", {
      title: name ? `${name}'s CV` : "My CV",
      templateId: h.template ?? "classic",
      accent: h.accent ?? null,
      data: h.cv,
    });
    return { kind: "open", href: `/edit/${resume.id}` };
  } catch (e) {
    if (isApiError(e, "PLAN_REQUIRED")) return { kind: "limit" };
    throw e;
  }
}

/** Keeps the CV in this browser and sends the visitor to sign up; it lands in their account after. */
export function saveAndSignUp(h: Handoff): HandoffResult {
  return saveForGuest(h) ? { kind: "open", href: `/sign-up?next=${encodeURIComponent("/app")}` } : { kind: "cancelled" };
}
