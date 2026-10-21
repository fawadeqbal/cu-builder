import { isAccent, isTemplateId } from "@/templates/catalog";
import type { CV, Personal, TemplateId } from "./types";

export function newId(prefix = "id"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export const emptyPersonal: Personal = {
  name: "",
  headline: "",
  tagline: "",
  phone: "",
  email: "",
  location: "",
  website: "",
  github: "",
  linkedin: "",
  extra: "",
};

export const emptyCV: CV = {
  personal: emptyPersonal,
  summary: "",
  experience: [],
  projects: [],
  skills: [],
  education: [],
  certificates: [],
  languages: [],
};

/** Turns "github.com/me" into a clickable https URL. */
export function linkHref(value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (/^(https?:|mailto:|tel:)/i.test(v)) return v;
  return `https://${v}`;
}

/** Shows a URL without protocol or trailing slash. */
export function linkLabel(value: string): string {
  return value.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

export function clean(lines: string[]): string[] {
  return lines.map((l) => l.trim()).filter(Boolean);
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const strList = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
const objList = (v: unknown) =>
  Array.isArray(v)
    ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    : [];

/** Accepts any parsed JSON and returns a valid CV, filling gaps with empty values. */
export function normalizeCV(input: unknown): CV {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const p = (o.personal && typeof o.personal === "object" ? o.personal : {}) as Record<
    string,
    unknown
  >;
  const personal = Object.fromEntries(
    Object.keys(emptyPersonal).map((k) => [k, str(p[k])]),
  ) as Personal;

  return {
    personal,
    summary: str(o.summary),
    experience: objList(o.experience).map((x) => ({
      id: str(x.id) || newId("exp"),
      role: str(x.role),
      company: str(x.company),
      location: str(x.location),
      date: str(x.date),
      bullets: strList(x.bullets),
      stack: str(x.stack),
    })),
    projects: objList(o.projects).map((x) => ({
      id: str(x.id) || newId("proj"),
      name: str(x.name),
      date: str(x.date),
      links: strList(x.links),
      bullets: strList(x.bullets),
      stack: str(x.stack),
    })),
    skills: objList(o.skills).map((x) => ({
      id: str(x.id) || newId("skill"),
      category: str(x.category),
      items: str(x.items),
    })),
    education: objList(o.education).map((x) => ({
      id: str(x.id) || newId("edu"),
      degree: str(x.degree),
      school: str(x.school),
      date: str(x.date),
      details: str(x.details),
    })),
    certificates: objList(o.certificates).map((x) => ({
      id: str(x.id) || newId("cert"),
      name: str(x.name),
      issuer: str(x.issuer),
      year: str(x.year),
      url: str(x.url),
    })),
    languages: objList(o.languages).map((x) => ({
      id: str(x.id) || newId("lang"),
      name: str(x.name),
      level: str(x.level),
    })),
  };
}

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
