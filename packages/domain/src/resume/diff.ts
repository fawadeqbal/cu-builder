import type { CV } from "./types";

/**
 * Field-level differences between two CVs, for reviewing suggested edits (tailoring, AI) before
 * anything is applied. Each change can be accepted on its own; `applyChanges` builds the result.
 */

export type CvChange = {
  id: string;
  /** Section the change belongs to, for grouping in the review list. */
  section: "personal" | "summary" | "experience" | "projects" | "skills" | "education";
  label: string;
  before: string | string[] | null;
  after: string | string[];
  /** Where it lives: list name, item id (or null for top level), field. */
  target: { list: keyof CV | null; itemId: string | null; field: string };
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const norm = (v: string | string[]) => (Array.isArray(v) ? v.map((s) => s.trim()).filter(Boolean) : v.trim());

type ListName = "experience" | "projects" | "skills" | "education";
const LIST_FIELDS: Record<ListName, string[]> = {
  experience: ["role", "bullets", "stack"],
  projects: ["bullets", "stack"],
  skills: ["category", "items"],
  education: ["details"],
};

const itemName = (list: ListName, item: Record<string, unknown>): string => {
  const v =
    list === "experience"
      ? [item.role, item.company].filter(Boolean).join(" at ")
      : list === "projects"
        ? item.name
        : list === "skills"
          ? item.category
          : item.degree;
  return String(v || "Untitled");
};

export function diffCV(base: CV, next: CV): CvChange[] {
  const out: CvChange[] = [];
  for (const field of ["headline", "tagline"] as const) {
    if (!same(norm(base.personal[field]), norm(next.personal[field]))) {
      out.push({
        id: `personal.${field}`,
        section: "personal",
        label: field === "headline" ? "Job title" : "Key skills line",
        before: base.personal[field] || null,
        after: next.personal[field],
        target: { list: null, itemId: null, field: `personal.${field}` },
      });
    }
  }
  if (!same(norm(base.summary), norm(next.summary))) {
    out.push({ id: "summary", section: "summary", label: "Summary", before: base.summary || null, after: next.summary, target: { list: null, itemId: null, field: "summary" } });
  }
  for (const list of Object.keys(LIST_FIELDS) as ListName[]) {
    const before = new Map((base[list] as unknown as Record<string, unknown>[]).map((i) => [String(i.id), i]));
    for (const item of next[list] as unknown as Record<string, unknown>[]) {
      const id = String(item.id);
      const old = before.get(id);
      if (!old) {
        out.push({
          id: `${list}.${id}.new`,
          section: list,
          label: `New ${list === "skills" ? "skills group" : "entry"}: ${itemName(list, item)}`,
          before: null,
          after: list === "skills" ? String(item.items ?? "") : itemName(list, item),
          target: { list, itemId: id, field: "*" },
        });
        continue;
      }
      for (const field of LIST_FIELDS[list]) {
        const a = old[field] as string | string[];
        const b = item[field] as string | string[];
        if (b === undefined || same(norm(a ?? ""), norm(b))) continue;
        out.push({
          id: `${list}.${id}.${field}`,
          section: list,
          label: `${itemName(list, old)}: ${field === "bullets" ? "achievements" : field === "items" ? "skills" : field}`,
          before: a ?? null,
          after: b,
          target: { list, itemId: id, field },
        });
      }
    }
  }
  return out;
}

/** The base CV with only the accepted changes from `next` applied. */
export function applyChanges(base: CV, next: CV, changes: CvChange[], accepted: ReadonlySet<string>): CV {
  let cv: CV = structuredClone(base);
  for (const change of changes) {
    if (!accepted.has(change.id)) continue;
    const { list, itemId, field } = change.target;
    if (!list) {
      if (field === "summary") cv = { ...cv, summary: next.summary };
      else if (field.startsWith("personal.")) {
        const key = field.slice("personal.".length) as keyof CV["personal"];
        cv = { ...cv, personal: { ...cv.personal, [key]: next.personal[key] } };
      }
      continue;
    }
    const nextItem = (next[list] as unknown as Record<string, unknown>[]).find((i) => i.id === itemId);
    if (!nextItem) continue;
    const items = cv[list] as unknown as Record<string, unknown>[];
    if (field === "*") {
      cv = { ...cv, [list]: [...items, structuredClone(nextItem)] };
    } else {
      cv = { ...cv, [list]: items.map((i) => (i.id === itemId ? { ...i, [field]: structuredClone(nextItem[field]) } : i)) };
    }
  }
  return cv;
}
