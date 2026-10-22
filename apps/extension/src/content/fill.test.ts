// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { planFill } from "./fill";
import { reviewFill } from "./panel";

const FORM = `
  <form id="apply">
    <label for="fn">First name</label><input id="fn" name="first_name">
    <label for="ln">Last name</label><input id="ln" name="last_name">
    <label>Email <input type="email" name="contact"></label>
    <input name="phone" placeholder="Phone number" value="0300 1234567">
    <label for="co">Company name</label><input id="co" name="company">
    <label for="li">LinkedIn profile</label><input id="li" name="q_123">
    <input type="file" name="resume">
    <input type="hidden" name="token" value="x">
    <button type="submit">Submit application</button>
  </form>`;

const values = { firstName: "Sara", lastName: "Khan", email: "sara@x.dev", phone: "+92 300 0000000", linkedin: "https://linkedin.com/in/sara", fullName: "Sara Khan" };

describe("autofill", () => {
  it("plans only the fields it recognises", () => {
    document.body.innerHTML = FORM;
    const plan = planFill(document, values);
    expect(plan.map((p) => [p.kind, p.label])).toEqual([
      ["firstName", "First name"],
      ["lastName", "Last name"],
      ["email", "Email"],
      ["phone", "Phone number"],
      ["linkedin", "LinkedIn profile"],
    ]);
  });

  it("fills only after review, keeps typed values unless ticked, and never submits", () => {
    document.body.innerHTML = FORM;
    const form = document.getElementById("apply") as HTMLFormElement;
    const submitted = vi.fn((e: Event) => e.preventDefault());
    form.addEventListener("submit", submitted);
    const input = vi.fn();
    form.addEventListener("input", input);

    expect(reviewFill(values).found).toBe(5);
    expect((document.getElementById("fn") as HTMLInputElement).value).toBe("");

    const root = document.getElementById("cvb-autofill-review")!.shadowRoot!;
    const boxes = [...root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    expect(boxes.map((b) => b.checked)).toEqual([true, true, true, false, true]);
    [...root.querySelectorAll("button")].find((b) => b.textContent === "Fill")!.click();

    expect((document.getElementById("fn") as HTMLInputElement).value).toBe("Sara");
    expect((document.querySelector('[name="contact"]') as HTMLInputElement).value).toBe("sara@x.dev");
    expect((document.querySelector('[name="phone"]') as HTMLInputElement).value).toBe("0300 1234567");
    expect((document.getElementById("co") as HTMLInputElement).value).toBe("");
    expect(input).toHaveBeenCalledTimes(4);
    expect(submitted).not.toHaveBeenCalled();
    expect(document.getElementById("cvb-autofill-review")).toBeNull();
  });
});
