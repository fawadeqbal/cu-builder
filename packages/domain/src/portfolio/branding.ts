import { darken, expandHex, isHexColor } from "./colors";

/** A partner's white-label settings (Organization.branding). */
export type Branding = {
  productName: string;
  /** https URL or a small data: URL. */
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  /** Templates offered under this brand; empty means all. */
  templateIds: string[];
  /** Hide "CV Builder" mentions (footer credits, product name). */
  hideBrand: boolean;
};

export const DEFAULT_BRANDING: Branding = {
  productName: "",
  logoUrl: "",
  primaryColor: "",
  accentColor: "",
  templateIds: [],
  hideBrand: false,
};

/** Accepts whatever is stored and returns valid branding, dropping bad values. */
export function normalizeBranding(input: unknown): Branding {
  const v = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const str = (k: string, max: number) => (typeof v[k] === "string" ? (v[k] as string).slice(0, max) : "");
  const color = (k: string) => {
    const c = str(k, 7);
    return isHexColor(c) ? expandHex(c) : "";
  };
  const logo = str("logoUrl", 140_000);
  return {
    productName: str("productName", 60).trim(),
    logoUrl: /^(https:\/\/|data:image\/(png|jpeg|webp|svg\+xml);base64,)/.test(logo) ? logo : "",
    primaryColor: color("primaryColor"),
    accentColor: color("accentColor"),
    templateIds: Array.isArray(v.templateIds) ? v.templateIds.filter((t): t is string => typeof t === "string").slice(0, 50) : [],
    hideBrand: v.hideBrand === true,
  };
}

/** The templates a brand offers, in catalogue order; all of them when the brand doesn't choose. */
export function allowedTemplates<T extends { id: string }>(branding: Pick<Branding, "templateIds"> | null | undefined, all: readonly T[]): T[] {
  const ids = branding?.templateIds ?? [];
  if (!ids.length) return [...all];
  const keep = all.filter((t) => ids.includes(t.id));
  return keep.length ? keep : [...all];
}

/** CSS custom properties the web app reads for its brand colours. */
export function brandCssVariables(b: Pick<Branding, "primaryColor" | "accentColor">): Record<string, string> {
  if (!b.primaryColor) return {};
  return { "--color-brand": b.primaryColor, "--color-brand-dark": darken(b.primaryColor, 0.2) };
}
