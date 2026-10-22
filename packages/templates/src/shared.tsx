import { clean, cvLanguage, DETAIL_LABELS, linkHref, linkLabel, showPhoto, visibleDetails, type CV, type Personal, type StepId } from "@cvb/domain";
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

/** One contact detail. Email, phone and links are kept left-to-right inside right-to-left CVs. */
export function ContactText({ c }: { c: Contact }) {
  if (c.href && c.kind !== "phone")
    return (
      <a href={c.href} dir="ltr" className="cv-ltr">
        {c.text}
      </a>
    );
  return c.kind === "phone" ? (
    <span dir="ltr" className="cv-ltr">
      {c.text}
    </span>
  ) : (
    <>{c.text}</>
  );
}

/**
 * "React, Next.js (App Router, RSC) · Node" → ["React", "Next.js (App Router, RSC)", "Node"].
 * Separators inside brackets don't split, so "AWS (EC2, S3)" stays one skill.
 */
export function splitItems(items: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of items) {
    if (ch === "(" || ch === "[") depth++;
    else if ((ch === ")" || ch === "]") && depth > 0) depth--;
    if (depth === 0 && /[,;·|\n]/.test(ch)) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
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

// ─── Language, direction, photo and personal details ────────────────────────

type Lang = "ur" | "ar";

/** Template headings in the CV's own language. Keys are the English text the templates use. */
const HEADINGS: Record<string, Record<Lang, string>> = {
  About: { ur: "تعارف", ar: "نبذة" },
  "About me": { ur: "میرے بارے میں", ar: "نبذة عني" },
  Additional: { ur: "اضافی معلومات", ar: "معلومات إضافية" },
  "Career History": { ur: "پیشہ ورانہ سفر", ar: "المسيرة المهنية" },
  Certificates: { ur: "سرٹیفکیٹس", ar: "الشهادات" },
  "Core Competencies": { ur: "بنیادی مہارتیں", ar: "الكفاءات الأساسية" },
  Credentials: { ur: "اسناد", ar: "المؤهلات" },
  Education: { ur: "تعلیم", ar: "التعليم" },
  "Executive Summary": { ur: "خلاصہ", ar: "الملخص التنفيذي" },
  Experience: { ur: "تجربہ", ar: "الخبرة" },
  Expertise: { ur: "مہارت", ar: "مجالات الخبرة" },
  Extras: { ur: "اضافی", ar: "إضافات" },
  "Key Initiatives": { ur: "اہم منصوبے", ar: "المبادرات الرئيسية" },
  Languages: { ur: "زبانیں", ar: "اللغات" },
  "Professional Experience": { ur: "پیشہ ورانہ تجربہ", ar: "الخبرة المهنية" },
  Profile: { ur: "پروفائل", ar: "الملف الشخصي" },
  Projects: { ur: "منصوبے", ar: "المشاريع" },
  "Selected Projects": { ur: "منتخب منصوبے", ar: "مشاريع مختارة" },
  "Selected Work": { ur: "منتخب کام", ar: "أعمال مختارة" },
  Skills: { ur: "مہارتیں", ar: "المهارات" },
  Summary: { ur: "خلاصہ", ar: "الملخص" },
  "Work experience": { ur: "ملازمت کا تجربہ", ar: "الخبرة العملية" },
  Work: { ur: "ملازمت کا", ar: "الخبرة" },
  experience: { ur: "تجربہ", ar: "العملية" },
  "Your Name": { ur: "آپ کا نام", ar: "اسمك" },
  "Stack:": { ur: "ٹیکنالوجی:", ar: "التقنيات:" },
  "Tools:": { ur: "ٹولز:", ar: "الأدوات:" },
  Certifications: { ur: "سرٹیفکیشنز", ar: "الشهادات" },
  "and training": { ur: "اور تربیت", ar: "والتدريب" },
  Contact: { ur: "رابطہ", ar: "التواصل" },
  Email: { ur: "ای میل", ar: "البريد" },
  Phone: { ur: "فون", ar: "الهاتف" },
  Location: { ur: "مقام", ar: "الموقع" },
  Website: { ur: "ویب سائٹ", ar: "الموقع الإلكتروني" },
  LinkedIn: { ur: "لنکڈ اِن", ar: "لينكدإن" },
  GitHub: { ur: "گِٹ ہب", ar: "غيت هب" },
  Other: { ur: "دیگر", ar: "أخرى" },
  "Personal details": { ur: "ذاتی معلومات", ar: "البيانات الشخصية" },
  "Date of birth": { ur: "تاریخ پیدائش", ar: "تاريخ الميلاد" },
  Nationality: { ur: "قومیت", ar: "الجنسية" },
  Gender: { ur: "جنس", ar: "الجنس" },
  "Marital status": { ur: "ازدواجی حیثیت", ar: "الحالة الاجتماعية" },
  "Visa status": { ur: "ویزا کی حیثیت", ar: "حالة التأشيرة" },
  "Driving licence": { ur: "ڈرائیونگ لائسنس", ar: "رخصة القيادة" },
  "Father's name": { ur: "والد کا نام", ar: "اسم الأب" },
  "CNIC / ID number": { ur: "شناختی کارڈ نمبر", ar: "رقم الهوية" },
  Religion: { ur: "مذہب", ar: "الديانة" },
};

export type Translate = (english: string) => string;

/** `tr("Experience")` in the CV's heading language (English text when there's no translation). */
export function cvLabels(cv: CV): Translate {
  const lang = cvLanguage(cv);
  if (lang === "en") return (s) => s;
  return (s) => HEADINGS[s]?.[lang] ?? s;
}

/** The profile photo, when the CV has one and its region shows photos. `side` sits in a column. */
export function Photo({ cv, variant = "head" }: { cv: CV; variant?: "head" | "side" }) {
  if (!showPhoto(cv)) return null;
  return (
    <img src={cv.photo} alt="" className={`cv-photo cv-photo--${variant} cv-photo--${cv.settings.photo.shape}`} />
  );
}

/** Date of birth, nationality, visa status… as the CV's region expects them. */
export function PersonalDetailsList({ cv, tr, className = "" }: { cv: CV; tr: Translate; className?: string }) {
  const items = visibleDetails(cv);
  if (!items.length) return null;
  return (
    <dl className={`cv-details ${className}`} data-step="personal">
      {items.map((d) => (
        <div key={d.key}>
          <dt>{tr(DETAIL_LABELS[d.key])}</dt>
          <dd>{d.value}</dd>
        </div>
      ))}
    </dl>
  );
}
