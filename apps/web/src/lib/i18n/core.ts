import { ar, en, ur, type MessageKey, type Messages } from "./messages";

export type Locale = "en" | "ur" | "ar";
export type { MessageKey };

export const LOCALES: { code: Locale; label: string; dir: "ltr" | "rtl" }[] = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "ur", label: "اردو", dir: "rtl" },
  { code: "ar", label: "العربية", dir: "rtl" },
];

export const LOCALE_COOKIE = "cvb-locale";
const DICTS: Record<Locale, Messages> = { en, ur, ar };

/** Maps any locale tag ("ur-PK", "en-GB", "ar_AE", "de") to a supported UI language, or null. */
export function supportedLocale(tag: string | null | undefined): Locale | null {
  const base = (tag ?? "").trim().toLowerCase().split(/[-_]/)[0];
  return base === "ur" || base === "ar" || base === "en" ? base : null;
}

/** Picks the UI language from an Accept-Language header, by quality. */
export function fromAcceptLanguage(header: string | null | undefined): Locale | null {
  const ranked = (header ?? "")
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = Number(params.find((p) => p.trim().startsWith("q="))?.split("=")[1] ?? 1);
      return { tag: tag ?? "", q: Number.isFinite(q) ? q : 0 };
    })
    .sort((a, b) => b.q - a.q);
  for (const r of ranked) {
    const l = supportedLocale(r.tag);
    if (l) return l;
  }
  return null;
}

export const dirOf = (locale: Locale): "ltr" | "rtl" => (locale === "en" ? "ltr" : "rtl");

export type Vars = Record<string, string | number>;

/** The text for `key` in `locale` (English when missing), with `{placeholders}` filled. */
export function translate(locale: Locale, key: MessageKey, vars?: Vars): string {
  const text = DICTS[locale][key] ?? en[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text;
}
