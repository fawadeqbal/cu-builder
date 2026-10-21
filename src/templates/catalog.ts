/**
 * Every CV template and what the gallery needs to know about it. Metadata only (no components),
 * so storage and the gallery can use it without loading the templates.
 *
 * To add a template: write the component, add its styles, then add an entry here and to
 * `COMPONENTS` in `templates/index.tsx`.
 */

export const TEMPLATE_IDS = [
  "simple",
  "compact",
  "classic",
  "modern",
  "timeline",
  "nordic",
  "sidebar",
  "tech",
  "creative",
  "elegant",
  "executive",
  "boardroom",
] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];

export type Tier = "basic" | "standard" | "premium" | "executive";
export type Style = "professional" | "modern" | "creative" | "minimal" | "executive";
export type LayoutKind = "single" | "two-column" | "sidebar";

export type TemplateMeta = {
  id: TemplateId;
  name: string;
  description: string;
  tier: Tier;
  style: Style;
  layout: LayoutKind;
  /** Plain reading order that applicant tracking systems parse reliably. */
  ats: boolean;
  /** The template's own accent colour. */
  accent: string;
  /** A few words for the card. */
  bestFor: string;
};

export const TIERS: { id: Tier; name: string; blurb: string }[] = [
  { id: "basic", name: "Basic", blurb: "Clean, safe, one column" },
  { id: "standard", name: "Standard", blurb: "Polished everyday designs" },
  { id: "premium", name: "Premium", blurb: "Distinctive, design-led" },
  { id: "executive", name: "Executive", blurb: "Refined, for senior roles" },
];

export const STYLES: { id: Style; name: string }[] = [
  { id: "professional", name: "Professional" },
  { id: "modern", name: "Modern" },
  { id: "creative", name: "Creative" },
  { id: "minimal", name: "Minimal" },
  { id: "executive", name: "Executive" },
];

export const LAYOUTS: { id: LayoutKind; name: string }[] = [
  { id: "single", name: "One column" },
  { id: "two-column", name: "Two columns" },
  { id: "sidebar", name: "Sidebar" },
];

/** Accent colours offered for every template; all read at 4.5:1 or better on white. */
export const ACCENTS: { name: string; value: string }[] = [
  { name: "Navy", value: "#1e4b8f" },
  { name: "Midnight", value: "#1f2a44" },
  { name: "Indigo", value: "#4338ca" },
  { name: "Cyan", value: "#0e7490" },
  { name: "Teal", value: "#0f766e" },
  { name: "Emerald", value: "#047857" },
  { name: "Slate", value: "#334155" },
  { name: "Charcoal", value: "#27272a" },
  { name: "Burgundy", value: "#7f1d3a" },
  { name: "Plum", value: "#6b21a8" },
  { name: "Rust", value: "#c2410c" },
  { name: "Gold", value: "#7c5e10" },
];

export const TEMPLATES: TemplateMeta[] = [
  {
    id: "simple",
    name: "Simple",
    description: "Centred name, one column, clear rules between sections.",
    tier: "basic",
    style: "minimal",
    layout: "single",
    ats: true,
    accent: "#27272a",
    bestFor: "Any job, first CV",
  },
  {
    id: "compact",
    name: "Compact",
    description: "Dense and tidy, fits a lot on one page.",
    tier: "basic",
    style: "professional",
    layout: "single",
    ats: true,
    accent: "#334155",
    bestFor: "Long experience, one page",
  },
  {
    id: "classic",
    name: "Classic",
    description: "Europass style with section labels in a left column.",
    tier: "basic",
    style: "professional",
    layout: "single",
    ats: true,
    accent: "#1e4b8f",
    bestFor: "Europe, public sector",
  },
  {
    id: "modern",
    name: "Modern",
    description: "Serif name and a two-column body with a side panel.",
    tier: "standard",
    style: "modern",
    layout: "two-column",
    ats: false,
    accent: "#0f766e",
    bestFor: "Tech and product roles",
  },
  {
    id: "timeline",
    name: "Timeline",
    description: "Your career on a vertical timeline, dates on the left.",
    tier: "standard",
    style: "modern",
    layout: "single",
    ats: true,
    accent: "#4338ca",
    bestFor: "Showing career growth",
  },
  {
    id: "nordic",
    name: "Nordic",
    description: "Airy and quiet, light type and generous space.",
    tier: "standard",
    style: "minimal",
    layout: "single",
    ats: true,
    accent: "#0e7490",
    bestFor: "Design, research, academia",
  },
  {
    id: "sidebar",
    name: "Sidebar Pro",
    description: "A coloured sidebar with contact, skills and languages.",
    tier: "premium",
    style: "creative",
    layout: "sidebar",
    ats: false,
    accent: "#1f2a44",
    bestFor: "Standing out, portfolios",
  },
  {
    id: "tech",
    name: "Developer",
    description: "Mono accents, skill chips and projects up front.",
    tier: "premium",
    style: "modern",
    layout: "single",
    ats: true,
    accent: "#047857",
    bestFor: "Engineers and developers",
  },
  {
    id: "creative",
    name: "Creative",
    description: "Bold colour header and a two-column body.",
    tier: "premium",
    style: "creative",
    layout: "two-column",
    ats: false,
    accent: "#c2410c",
    bestFor: "Marketing, media, design",
  },
  {
    id: "elegant",
    name: "Elegant",
    description: "All-serif, centred, with fine ruled headings.",
    tier: "executive",
    style: "professional",
    layout: "single",
    ats: true,
    accent: "#7f1d3a",
    bestFor: "Law, finance, consulting",
  },
  {
    id: "executive",
    name: "Executive",
    description: "Dark header band and a core-competencies grid.",
    tier: "executive",
    style: "executive",
    layout: "single",
    ats: true,
    accent: "#1f2a44",
    bestFor: "Managers and directors",
  },
  {
    id: "boardroom",
    name: "Boardroom",
    description: "Serif name in a side column, gold accents.",
    tier: "executive",
    style: "executive",
    layout: "two-column",
    ats: false,
    accent: "#7c5e10",
    bestFor: "C-level and board roles",
  },
];

export const isTemplateId = (v: unknown): v is TemplateId =>
  typeof v === "string" && (TEMPLATE_IDS as readonly string[]).includes(v);

export const templateMeta = (id: TemplateId): TemplateMeta => TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[2];

export const isAccent = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);

/** "Modern · Two columns · ATS-friendly · Best for: …" */
export function templateTags(t: TemplateMeta): string {
  const style = STYLES.find((s) => s.id === t.style)?.name;
  const layout = LAYOUTS.find((l) => l.id === t.layout)?.name;
  return [style, layout, t.ats ? "ATS-friendly" : null, `Best for: ${t.bestFor}`].filter(Boolean).join(" · ");
}
