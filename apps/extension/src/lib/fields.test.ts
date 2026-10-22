import { emptyCV } from "@cvb/domain";
import { describe, expect, it } from "vitest";
import { classifyField, valuesFromCV, type FieldDescriptor } from "./fields";

const f = (p: Partial<FieldDescriptor>): FieldDescriptor => ({ tag: "input", type: "text", name: "", id: "", label: "", placeholder: "", autocomplete: "", ariaLabel: "", ...p });

describe("classifyField", () => {
  it.each([
    [f({ autocomplete: "given-name" }), "firstName"],
    [f({ name: "firstName" }), "firstName"],
    [f({ name: "applicant[last_name]" }), "lastName"],
    [f({ label: "Full name *" }), "fullName"],
    [f({ name: "name" }), "fullName"],
    [f({ type: "email", name: "x1" }), "email"],
    [f({ label: "Mobile number" }), "phone"],
    [f({ label: "LinkedIn profile URL" }), "linkedin"],
    [f({ name: "urls[GitHub]" }), "github"],
    [f({ label: "Portfolio or website" }), "website"],
    [f({ label: "City" }), "city"],
    [f({ placeholder: "Current location" }), "location"],
    [f({ label: "Current job title" }), "title"],
  ])("%o → %s", (d, kind) => expect(classifyField(d)).toBe(kind));

  it("leaves other fields alone", () => {
    expect(classifyField(f({ label: "Company name" }))).toBeNull();
    expect(classifyField(f({ label: "Reference name" }))).toBeNull();
    expect(classifyField(f({ type: "file", label: "Resume" }))).toBeNull();
    expect(classifyField(f({ type: "password", label: "Password" }))).toBeNull();
    expect(classifyField(f({ tag: "textarea", label: "Cover letter" }))).toBeNull();
    expect(classifyField(f({ label: "Desired salary" }))).toBeNull();
  });
});

describe("valuesFromCV", () => {
  it("splits the name and makes links absolute", () => {
    const v = valuesFromCV({
      ...emptyCV,
      personal: { ...emptyCV.personal, name: "Sara Ahmed Khan", email: "sara@x.dev", location: "Lahore, Pakistan", linkedin: "linkedin.com/in/sara", headline: "" },
      experience: [{ id: "e", role: "Frontend Engineer", company: "Acme", location: "", date: "", bullets: [], stack: "" }],
    } as never);
    expect(v).toMatchObject({ firstName: "Sara", lastName: "Ahmed Khan", city: "Lahore", location: "Lahore, Pakistan", linkedin: "https://linkedin.com/in/sara", title: "Frontend Engineer", website: "" });
  });
});
