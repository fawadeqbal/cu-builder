import type { FieldKind } from "../lib/fields";
import { planFill, setValue, type PlannedFill } from "./fill";

const HOST_ID = "cvb-autofill-review";

// Design-system tokens, inlined at build time with :root turned into :host (see build.mjs), so the
// panel follows the page's light/dark preference without touching the page's own styles.
declare const __TOKENS_CSS__: string | undefined;
const TOKENS = typeof __TOKENS_CSS__ === "string" ? __TOKENS_CSS__ : "";

const STYLE = `
${TOKENS}
:host { all: initial; }
.panel { position: fixed; z-index: 2147483647; inset-inline-end: 16px; inset-block-end: 16px; width: 340px; max-height: 70vh; display: flex; flex-direction: column;
  background: var(--surface, #fafafa); color: var(--ink, #1a1a1a); border: 1px solid var(--line, #d6d6d6); border-radius: 16px; box-shadow: var(--shadow-lg, 0 12px 40px rgba(0,0,0,.18));
  font: 14px/22px system-ui, "Segoe UI", sans-serif; }
header { padding: 12px 14px; display: flex; gap: 8px; align-items: center; background: var(--appbar-bg, #004494); color: var(--appbar-ink, #fff); border-radius: 15px 15px 0 0; }
header b { flex: 1; font-size: 14px; }
.mark .page { fill: var(--appbar-ink, #fff); } .mark .fold { fill: var(--gold, #ffd617); } .mark .line { stroke: var(--appbar-bg, #004494); }
ul { list-style: none; margin: 0; padding: 6px 8px; overflow: auto; }
li label { display: flex; gap: 10px; padding: 8px; border-radius: 8px; cursor: pointer; }
li label:hover { background: var(--surface-2, #f2f2f2); }
input[type="checkbox"] { width: 16px; height: 16px; margin: 2px 0 0; accent-color: var(--brand, #004494); }
.k { font-size: 12px; line-height: 16px; color: var(--ink-3, #5c5c5c); }
.v { font-weight: 600; word-break: break-all; }
.was { font-size: 12px; line-height: 16px; color: var(--warning, #99480a); }
footer { padding: 10px 14px; border-top: 1px solid var(--line, #d6d6d6); background: var(--surface-2, #f2f2f2); border-radius: 0 0 15px 15px; display: flex; gap: 8px; justify-content: flex-end; align-items: center; }
footer small { flex: 1; color: var(--ink-3, #5c5c5c); font-size: 12px; line-height: 16px; }
button { font: 600 13px/18px system-ui, "Segoe UI", sans-serif; border-radius: 8px; min-height: 36px; padding: 0 14px; cursor: pointer; border: 1px solid var(--line-control, #707070); background: var(--surface, #fafafa); color: var(--ink, #1a1a1a); }
button:hover { background: var(--surface-2, #f2f2f2); }
button:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--surface, #fff), 0 0 0 4px var(--focus, #0b5bbf); }
button.primary { background: var(--brand, #004494); border-color: var(--brand, #004494); color: var(--on-brand, #fff); }
button.primary:hover { background: var(--brand-hover, #003776); }
p { margin: 12px 14px; color: var(--ink-2, #404040); }
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
  badge.innerHTML =
    '<svg class="mark" width="22" height="22" viewBox="0 0 32 32" aria-hidden="true"><path class="page" d="M8 3h12.5L27 9.5V26a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z"/><path class="fold" d="M20.5 3L27 9.5h-4.5a2 2 0 0 1-2-2z"/><path class="line" d="M10 16h9M10 21h6" fill="none" stroke-width="2.2" stroke-linecap="round"/></svg>';
  badge.style.display = "inline-flex";
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
