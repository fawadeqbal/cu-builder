import { linkHref, type CV } from "@cvb/domain";

/** What an application form field asks for. */
export type FieldKind = "firstName" | "lastName" | "fullName" | "email" | "phone" | "city" | "location" | "linkedin" | "github" | "website" | "title";

export const FIELD_LABEL: Record<FieldKind, string> = {
  firstName: "First name",
  lastName: "Last name",
  fullName: "Full name",
  email: "Email",
  phone: "Phone",
  city: "City",
  location: "Location",
  linkedin: "LinkedIn",
  github: "GitHub",
  website: "Website",
  title: "Current title",
};

/** Everything we know about a form control, read from the page. */
export type FieldDescriptor = {
  tag: string;
  type: string;
  name: string;
  id: string;
  label: string;
  placeholder: string;
  autocomplete: string;
  ariaLabel: string;
};

const SKIP_TYPES = new Set(["hidden", "submit", "button", "reset", "file", "checkbox", "radio", "password", "image", "range", "color", "date", "datetime-local", "month", "week", "time", "number", "search"]);

const AUTOCOMPLETE: Record<string, FieldKind> = {
  "given-name": "firstName",
  "family-name": "lastName",
  name: "fullName",
  email: "email",
  tel: "phone",
  "tel-national": "phone",
  "address-level2": "city",
  "organization-title": "title",
  url: "website",
};

/** Decides what a field asks for, or null when it isn't one we fill. Order matters: specific before general. */
export function classifyField(f: FieldDescriptor): FieldKind | null {
  if (f.tag !== "input") return null;
  const type = (f.type || "text").toLowerCase();
  if (SKIP_TYPES.has(type)) return null;
  const ac = f.autocomplete.toLowerCase().trim().split(/\s+/).pop() ?? "";
  if (AUTOCOMPLETE[ac]) return AUTOCOMPLETE[ac];
  if (type === "email") return "email";
  if (type === "tel") return "phone";

  const text = [f.name, f.id, f.label, f.placeholder, f.ariaLabel]
    .join(" ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_\-[\]]+/g, " ")
    .toLowerCase();
  if (/\b(company|employer|school|university|college|reference|referr|recruiter|manager|emergency|salary|captcha|search|coupon|promo)\b/.test(text)) return null;
  if (/linked\s?in/.test(text)) return "linkedin";
  if (/git\s?hub/.test(text)) return "github";
  if (/\b(first|given|fore)\s?name\b|\bfname\b/.test(text)) return "firstName";
  if (/\b(last|family|sur)\s?name\b|\blname\b|\bsurname\b/.test(text)) return "lastName";
  if (/e-?mail/.test(text)) return "email";
  if (/\b(phone|mobile|cell|telephone|tel|contact number|whats\s?app)\b/.test(text)) return "phone";
  if (/\b(portfolio|website|web site|homepage|personal site|personal url|blog)\b/.test(text)) return "website";
  if (/\b(city|town)\b/.test(text)) return "city";
  if (/\b(location|address|where do you live|based in)\b/.test(text)) return "location";
  if (/\b(current|present|job|your)\s?(title|position|role|designation)\b|\bheadline\b/.test(text)) return "title";
  if (/\b(full\s?name|your name|candidate name|applicant name)\b|^\s*name\s*\*?\s*$|\bname\b/.test(text)) return "fullName";
  return null;
}

/** The values a CV gives for each kind of field ("" when it has none). */
export function valuesFromCV(cv: CV): Record<FieldKind, string> {
  const p = cv.personal;
  const name = p.name.trim();
  const [firstName = "", ...rest] = name.split(/\s+/);
  return {
    firstName,
    lastName: rest.join(" "),
    fullName: name,
    email: p.email.trim(),
    phone: p.phone.trim(),
    city: p.location.split(",")[0]?.trim() ?? "",
    location: p.location.trim(),
    linkedin: p.linkedin.trim() ? linkHref(p.linkedin) : "",
    github: p.github.trim() ? linkHref(p.github) : "",
    website: p.website.trim() ? linkHref(p.website) : "",
    title: p.headline.trim() || cv.experience[0]?.role.trim() || "",
  };
}
