import { clean, linkHref, linkLabel, type Personal, type StepId } from "@cvb/domain";
import type { ReactNode } from "react";

export type Contact = { key: string; text: string; href?: string; kind: "email" | "phone" | "location" | "web" | "extra" };

/** The person's contact details in a stable order, with links where they make sense. */
export function contacts(p: Personal): Contact[] {
  const out: Contact[] = [];
  if (p.email.trim()) out.push({ key: "email", kind: "email", text: p.email.trim(), href: `mailto:${p.email.trim()}` });
  if (p.phone.trim()) out.push({ key: "phone", kind: "phone", text: p.phone.trim(), href: `tel:${p.phone.replace(/[^+\d]/g, "")}` });
  if (p.location.trim()) out.push({ key: "location", kind: "location", text: p.location.trim() });
  for (const [key, v] of [["website", p.website], ["linkedin", p.linkedin], ["github", p.github]] as const) {
    if (v.trim()) out.push({ key, kind: "web", text: linkLabel(v), href: linkHref(v) });
  }
  if (p.extra.trim()) out.push({ key: "extra", kind: "extra", text: p.extra.trim() });
  return out;
}

export function ContactText({ c }: { c: Contact }) {
  return c.href && c.kind !== "phone" ? <a href={c.href}>{c.text}</a> : <>{c.text}</>;
}

/** "React, Next.js · Node" → ["React", "Next.js", "Node"] */
export function splitItems(items: string): string[] {
  return items
    .split(/\s*(?:,|;|·|\||\n)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "CV";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function Bullets({ items, className }: { items: string[]; className?: string }) {
  const list = clean(items);
  if (!list.length) return null;
  return (
    <ul className={className}>
      {list.map((b, i) => (
        <li key={i}>{b}</li>
      ))}
    </ul>
  );
}

export function ProjectLinks({ links, sep = " · " }: { links: string[]; sep?: string }) {
  const list = clean(links);
  if (!list.length) return null;
  return (
    <>
      {list.map((l, i) => (
        <span key={l}>
          {i > 0 && sep}
          <a href={linkHref(l)}>{linkLabel(l)}</a>
        </span>
      ))}
    </>
  );
}

/** A section wrapper carrying the step it is edited in, for click-to-edit. */
export function Block({
  step,
  className,
  children,
  as: Tag = "section",
}: {
  step: StepId;
  className?: string;
  children: ReactNode;
  as?: "section" | "div" | "header" | "aside";
}) {
  return (
    <Tag className={className} data-step={step}>
      {children}
    </Tag>
  );
}

export const joinParts = (parts: (string | undefined | false)[], sep = " · ") => parts.filter(Boolean).join(sep);
