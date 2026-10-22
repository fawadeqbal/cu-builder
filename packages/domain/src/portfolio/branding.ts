import { contrastRatio, darken, expandHex, isHexColor, lighten } from "./colors";

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

/**
 * Design-system tokens a partner's primary colour replaces (see packages/ui tokens.json): the brand
 * fills, brand text, focus ring and the app bar. Light theme values; set them on <html>.
 */
export function brandCssVariables(b: Pick<Branding, "primaryColor" | "accentColor">): Record<string, string> {
  if (!b.primaryColor) return {};
  const c = b.primaryColor;
  return {
    "--brand": c,
    "--brand-hover": darken(c, 0.18),
    "--brand-pressed": darken(c, 0.32),
    "--brand-ink": c,
    "--brand-soft": `color-mix(in srgb, ${c} 14%, var(--surface))`,
    "--focus": c,
    "--appbar-bg": c,
    "--appbar-hover": darken(c, 0.15),
    "--appbar-line": darken(c, 0.25),
  };
}

/**
 * The same, for the dark theme: the brand is raised until dark text reads on it (4.5:1), and the
 * app bar stays dark like the rest of the dark theme.
 */
export function brandCssVariablesDark(b: Pick<Branding, "primaryColor" | "accentColor">): Record<string, string> {
  if (!b.primaryColor) return {};
  let c = b.primaryColor;
  for (let i = 0; i < 10 && contrastRatio(c, "#141414") < 6; i++) c = lighten(c, 0.15);
  return {
    "--brand": c,
    "--brand-hover": lighten(c, 0.2),
    "--brand-pressed": lighten(c, 0.4),
    "--brand-ink": lighten(c, 0.15),
    "--brand-soft": `color-mix(in srgb, ${c} 16%, var(--surface))`,
    "--focus": lighten(c, 0.15),
    "--on-brand": "#0b1a2e",
  };
}

/** A stylesheet applying a brand to both themes (light, dark, and dark by system preference). */
export function brandStylesheet(b: Pick<Branding, "primaryColor" | "accentColor">): string {
  const light = brandCssVariables(b);
  if (!Object.keys(light).length) return "";
  const decl = (vars: Record<string, string>) =>
    Object.entries(vars)
      .map(([k, v]) => `${k}: ${v};`)
      .join(" ");
  const dark = decl(brandCssVariablesDark(b));
  return [
    `:root, [data-theme="light"] { ${decl(light)} }`,
    `[data-theme="dark"] { ${dark} }`,
    `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${dark} } }`,
  ].join("\n");
}
