import { z } from "zod";
import { PageSizeSchema, ResumeDataSchema } from "./resume";

const hex = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Use a hex colour like #1e4b8f");
const httpsUrl = z.url().max(2000).refine((u) => u.startsWith("https://"), "Use an https:// link");

// ─── Portfolio site ──────────────────────────────────────────────────────────

export const SiteSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(40)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single dashes");

export const PortfolioThemeSchema = z.enum(["minimal", "bold", "split"]);

export const PortfolioProjectSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().max(1200).default(""),
  url: z.union([httpsUrl, z.literal("")]).default(""),
  imageUrl: z.union([httpsUrl, z.literal("")]).default(""),
});

/** What a site adds to the CV. */
export const PortfolioContentSchema = z.object({
  about: z.string().max(4000).default(""),
  projects: z.array(PortfolioProjectSchema).max(12).default([]),
});
export type PortfolioContentDto = z.output<typeof PortfolioContentSchema>;

export const SavePortfolioSchema = z.object({
  resumeId: z.string().min(1).max(64),
  slug: SiteSlugSchema,
  theme: PortfolioThemeSchema.default("minimal"),
  accent: hex.nullable().default(null),
  showContactForm: z.boolean().default(true),
  published: z.boolean().default(false),
  content: PortfolioContentSchema.default({ about: "", projects: [] }),
});
export type SavePortfolioDto = z.output<typeof SavePortfolioSchema>;

export const DomainStatusSchema = z.object({
  domain: z.string().nullable(),
  verified: z.boolean(),
  /** Point a CNAME here (sub-domains)… */
  cnameTarget: z.string(),
  /** …or A records here (apex domains). Empty when not configured. */
  ipv4: z.array(z.string()),
});
export type DomainStatusDto = z.output<typeof DomainStatusSchema>;

export const PortfolioSchema = SavePortfolioSchema.extend({
  id: z.string(),
  /** Where the site lives: https://<slug>.<portfolio domain>, or /p/<slug> without one. */
  url: z.string(),
  customDomain: DomainStatusSchema,
  viewCount: z.number(),
  unreadMessages: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PortfolioDto = z.output<typeof PortfolioSchema>;

/** GET /portfolio: the site (if any) plus what the editor needs to suggest one. */
export const MyPortfolioSchema = z.object({
  site: PortfolioSchema.nullable(),
  suggestedSlug: z.string(),
  portfolioDomain: z.string().nullable(),
  canUseCustomDomain: z.boolean(),
});
export type MyPortfolioDto = z.output<typeof MyPortfolioSchema>;

export const CustomDomainSchema = z.object({ domain: z.string().trim().max(253).nullable() });

/** What a visitor of a portfolio receives. */
export const PublicSiteSchema = z.object({
  slug: z.string(),
  theme: PortfolioThemeSchema,
  accent: z.string().nullable(),
  showContactForm: z.boolean(),
  content: PortfolioContentSchema,
  ownerName: z.string(),
  templateId: z.string(),
  resumeAccent: z.string().nullable(),
  pageSize: PageSizeSchema,
  data: ResumeDataSchema,
  /** The canonical address, for SEO. */
  url: z.string(),
  /** Hide "Made with CV Builder" (custom domains on paid plans). */
  hideCredit: z.boolean(),
  /** The app's address, for the credit link (sites run on other hosts). */
  appUrl: z.string(),
});
export type PublicSiteDto = z.output<typeof PublicSiteSchema>;

export const ContactFormSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().max(200),
  message: z.string().trim().min(5).max(4000),
  /** Honeypot: hidden from people; bots fill it in. */
  website: z.string().max(500).optional(),
});
export type ContactFormDto = z.output<typeof ContactFormSchema>;

export const ContactMessageSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  message: z.string(),
  read: z.boolean(),
  createdAt: z.string(),
});
export type ContactMessageDto = z.output<typeof ContactMessageSchema>;

// ─── White label ─────────────────────────────────────────────────────────────

export const BrandingSchema = z.object({
  productName: z.string().trim().max(60).default(""),
  /** https URL, or a small image as a data: URL (100 KB at most). */
  logoUrl: z
    .string()
    .max(140_000, "Use a logo under 100 KB")
    .refine((v) => v === "" || v.startsWith("https://") || /^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(v), "Use an https link or upload a PNG, JPEG, WebP or SVG")
    .default(""),
  primaryColor: z.union([hex, z.literal("")]).default(""),
  accentColor: z.union([hex, z.literal("")]).default(""),
  templateIds: z.array(z.string().max(40)).max(50).default([]),
  hideBrand: z.boolean().default(false),
});
export type BrandingDto = z.output<typeof BrandingSchema>;

export const OrgBrandingSchema = z.object({
  orgId: z.string(),
  orgName: z.string(),
  branding: BrandingSchema,
  customDomain: DomainStatusSchema,
});
export type OrgBrandingDto = z.output<typeof OrgBrandingSchema>;

/** GET /public/branding?host=: a partner's brand for its own domain, or null. */
export const PublicBrandingSchema = BrandingSchema.extend({ orgName: z.string() }).nullable();
export type PublicBrandingDto = z.output<typeof PublicBrandingSchema>;

/** GET /public/domains/resolve?host=: what a custom host serves (used by the web proxy). */
export const HostTargetSchema = z.union([
  z.object({ kind: z.literal("portfolio"), slug: z.string() }),
  z.object({ kind: z.literal("org"), orgId: z.string() }),
  z.object({ kind: z.literal("none") }),
]);
export type HostTargetDto = z.output<typeof HostTargetSchema>;
