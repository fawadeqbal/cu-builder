import type { FieldKind } from "../lib/fields";
import { planFill, setValue, type PlannedFill } from "./fill";

const HOST_ID = "cvb-autofill-review";

const STYLE = `
:host { all: initial; }
.panel { position: fixed; z-index: 2147483647; right: 16px; bottom: 16px; width: 340px; max-height: 70vh; display: flex; flex-direction: column;
  background: #fff; color: #1c1917; border: 1px solid #e7e5e4; border-radius: 14px; box-shadow: 0 12px 40px rgba(0,0,0,.18);
  font: 14px/1.4 Inter, "Segoe UI", system-ui, sans-serif; }
header { padding: 12px 14px; border-bottom: 1px solid #f5f5f4; display: flex; gap: 8px; align-items: center; }
header b { flex: 1; font-size: 14px; }
.badge { background: #1e4b8f; color: #fff; font-weight: 700; font-size: 10px; padding: 4px 6px; border-radius: 5px; }
ul { list-style: none; margin: 0; padding: 6px 8px; overflow: auto; }
li label { display: flex; gap: 8px; padding: 6px; border-radius: 8px; cursor: pointer; }
li label:hover { background: #fafaf9; }
.k { font-size: 12px; color: #78716c; }
.v { font-weight: 600; word-break: break-all; }
.was { font-size: 12px; color: #b45309; }
footer { padding: 10px 14px; border-top: 1px solid #f5f5f4; display: flex; gap: 8px; justify-content: flex-end; align-items: center; }
footer small { flex: 1; color: #78716c; font-size: 12px; }
button { font: inherit; font-weight: 600; border-radius: 8px; padding: 7px 12px; cursor: pointer; border: 1px solid #e7e5e4; background: #fff; color: #1c1917; }
button.primary { background: #1e4b8f; border-color: #1e4b8f; color: #fff; }
p { margin: 12px 14px; color: #57534e; }
`;

/**
 * Shows which fields would be filled (each with a checkbox), and fills only the checked ones
 * after the person clicks "Fill". It never submits the form: the person reviews and applies.
 */
export function reviewFill(values: Partial<Record<FieldKind, string>>, doc: Document = document): { found: number } {
  doc.getElementById(HOST_ID)?.remove();
  const plan = planFill(doc, values);
  const host = doc.createElement("div");
  host.id = HOST_ID;
  const root = host.attachShadow({ mode: "open" });
  const style = doc.createElement("style");
  style.textContent = STYLE;
  const panel = doc.createElement("div");
  panel.className = "panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Review autofill");
  root.append(style, panel);

  const header = doc.createElement("header");
  const badge = doc.createElement("span");
  badge.className = "badge";
  badge.textContent = "CV";
  const title = doc.createElement("b");
  title.textContent = plan.length ? `Fill ${plan.length} field${plan.length === 1 ? "" : "s"}?` : "Nothing to fill";
  header.append(badge, title);
  panel.append(header);

  const close = () => host.remove();
  const checks: { item: PlannedFill; box: HTMLInputElement }[] = [];
  if (!plan.length) {
    const p = doc.createElement("p");
    p.textContent = "No name, email, phone, location or link fields were found on this page. Open the application form and try again.";
    panel.append(p);
  } else {
    const ul = doc.createElement("ul");
    for (const item of plan) {
      const li = doc.createElement("li");
      const label = doc.createElement("label");
      const box = doc.createElement("input");
      box.type = "checkbox";
      // Fields the person already typed in stay as they are unless they tick them.
      box.checked = !item.current.trim();
      const text = doc.createElement("span");
      const k = doc.createElement("div");
      k.className = "k";
      k.textContent = item.label;
      const v = doc.createElement("div");
      v.className = "v";
      v.textContent = item.value;
      text.append(k, v);
      if (item.current.trim()) {
        const was = doc.createElement("div");
        was.className = "was";
        was.textContent = `Already has: ${item.current.slice(0, 60)}`;
        text.append(was);
      }
      label.append(box, text);
      li.append(label);
      ul.append(li);
      checks.push({ item, box });
    }
    panel.append(ul);
  }

  const footer = doc.createElement("footer");
  const note = doc.createElement("small");
  note.textContent = "Nothing is submitted. Check the form before you apply.";
  const cancel = doc.createElement("button");
  cancel.type = "button";
  cancel.textContent = plan.length ? "Cancel" : "Close";
  cancel.addEventListener("click", close);
  footer.append(note, cancel);
  if (plan.length) {
    const fill = doc.createElement("button");
    fill.type = "button";
    fill.className = "primary";
    fill.textContent = "Fill";
    fill.addEventListener("click", () => {
      const chosen = checks.filter((c) => c.box.checked);
      for (const { item } of chosen) setValue(item.el, item.value);
      chosen[0]?.item.el.scrollIntoView({ block: "center", behavior: "smooth" });
      close();
    });
    footer.append(fill);
  }
  panel.append(footer);
  doc.documentElement.append(host);
  return { found: plan.length };
}
