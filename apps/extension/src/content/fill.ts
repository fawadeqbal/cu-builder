import { classifyField, FIELD_LABEL, type FieldDescriptor, type FieldKind } from "../lib/fields";
import { oneLine } from "../lib/text";

/** Reads what a control asks for: its name, id, label, placeholder, autocomplete and aria label. */
export function describeField(el: HTMLInputElement): FieldDescriptor {
  const doc = el.ownerDocument;
  let label = "";
  if (el.id) {
    try {
      const id = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(el.id) : el.id.replace(/["\\]/g, "\\$&");
      label = oneLine(doc.querySelector(`label[for="${id}"]`)?.textContent);
    } catch {
      label = "";
    }
  }
  if (!label) label = oneLine(el.closest("label")?.textContent);
  const labelledBy = el.getAttribute("aria-labelledby");
  if (!label && labelledBy) label = oneLine(labelledBy.split(/\s+/).map((id) => doc.getElementById(id)?.textContent ?? "").join(" "));
  return {
    tag: el.tagName.toLowerCase(),
    type: el.getAttribute("type") ?? "text",
    name: el.getAttribute("name") ?? "",
    id: el.id,
    label: label.slice(0, 120),
    placeholder: el.getAttribute("placeholder") ?? "",
    autocomplete: el.getAttribute("autocomplete") ?? "",
    ariaLabel: el.getAttribute("aria-label") ?? "",
  };
}

export type PlannedFill = { el: HTMLInputElement; kind: FieldKind; label: string; value: string; current: string };

const visible = (el: HTMLElement) => !el.hidden && el.getAttribute("aria-hidden") !== "true" && el.style.display !== "none" && el.style.visibility !== "hidden";

/** Which fields on the page we would fill, and with what. Each kind is filled once (the first match). */
export function planFill(doc: Document, values: Partial<Record<FieldKind, string>>): PlannedFill[] {
  const plan: PlannedFill[] = [];
  const used = new Set<FieldKind>();
  for (const el of doc.querySelectorAll<HTMLInputElement>("input")) {
    if (el.disabled || el.readOnly || !visible(el)) continue;
    const d = describeField(el);
    const kind = classifyField(d);
    const value = kind ? values[kind]?.trim() : "";
    if (!kind || !value || used.has(kind)) continue;
    used.add(kind);
    plan.push({ el, kind, label: d.label || d.placeholder || d.ariaLabel || FIELD_LABEL[kind], value, current: el.value });
  }
  return plan;
}

/** Sets a value the way typing would, so React/Vue forms notice it. Never submits anything. */
export function setValue(el: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el) as object, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.style.outline = "2px solid #1e4b8f";
  el.style.outlineOffset = "1px";
  el.style.backgroundColor = "#eef3fb";
}
