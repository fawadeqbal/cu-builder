import { z } from "zod";

/**
 * Environment building blocks. Each app composes the pieces it needs and validates once at
 * start-up, so a missing or malformed variable fails fast with a readable message.
 */
const bool = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

export const BaseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export const DatabaseEnvSchema = z.object({
  DATABASE_URL: z.url().refine((u) => u.startsWith("postgres"), "DATABASE_URL must be a Postgres URL"),
});

export const RedisEnvSchema = z.object({
  REDIS_URL: z.url().refine((u) => u.startsWith("redis"), "REDIS_URL must be a redis:// URL"),
});

const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

export const StorageEnvSchema = z.object({
  STORAGE_DIR: z.string().default("./storage"),
});

/** Public origin of the web app; the API sits behind it at /api on the same domain. */
export const AppUrlEnvSchema = z.object({
  APP_URL: z.url().default("http://localhost:3000"),
});

/**
 * AI writing: AI_PROVIDER=ollama uses a local or self-hosted Ollama server; "anthropic" uses
 * Claude; "offline" a deterministic stand-in. "auto" (default) is Claude when ANTHROPIC_API_KEY is
 * set, otherwise offline.
 */
export const AiEnvSchema = z.object({
  AI_PROVIDER: z.enum(["auto", "anthropic", "ollama", "offline"]).default("auto"),
  OLLAMA_URL: z.string().default("http://localhost:11434"),
  /** Ollama model names for quick edits and for drafts (pull them first: ollama pull qwen2.5:7b). */
  OLLAMA_MODEL_FAST: z.string().default("qwen2.5:7b"),
  OLLAMA_MODEL_SMART: z.string().default("qwen2.5:7b"),
  ANTHROPIC_API_KEY: optional,
  AI_MODEL_FAST: z.string().default("claude-haiku-5-5"),
  AI_MODEL_SMART: z.string().default("claude-sonnet-5-5"),
});

/**
 * Job feed providers. Company career boards, Himalayas, Remotive, Arbeitnow and RemoteOK need no
 * key; Jooble and Adzuna switch on when their keys are set.
 */
export const JobFeedEnvSchema = z.object({
  /** Optional free Himalayas key (higher rate limit). */
  HIMALAYAS_API_KEY: optional,
  /** Career boards to follow: "greenhouse:gitlab, lever:spotify=Spotify, ashby:ramp=Ramp". Unset = built-in list, "none" = off. */
  JOBFEED_COMPANIES: optional,
  JOOBLE_API_KEY: optional,
  ADZUNA_APP_ID: optional,
  ADZUNA_APP_KEY: optional,
  ADZUNA_COUNTRY: z.string().length(2).default("gb"),
});

/** Portfolio sites and custom domains (portfolios, white-label partners). */
export const SitesEnvSchema = z.object({
  /** Parent of portfolio sub-domains: <slug>.<PORTFOLIO_DOMAIN> (wildcard DNS to this server). */
  PORTFOLIO_DOMAIN: optional,
  /** Where custom domains point a CNAME. Defaults to the APP_URL host. */
  CUSTOM_DOMAIN_TARGET: optional,
  /** The server's public IPv4 addresses, for apex domains (A records). Comma-separated. */
  CUSTOM_DOMAIN_IPV4: z
    .string()
    .default("")
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),
});

export const ApiEnvSchema = BaseEnvSchema.extend(DatabaseEnvSchema.shape)
  .extend(RedisEnvSchema.shape)
  .extend(StorageEnvSchema.shape)
  .extend(AppUrlEnvSchema.shape)
  .extend(AiEnvSchema.shape)
  .extend(JobFeedEnvSchema.shape)
  .extend(SitesEnvSchema.shape)
  .extend({
    BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
    GOOGLE_CLIENT_ID: optional,
    GOOGLE_CLIENT_SECRET: optional,
    LINKEDIN_CLIENT_ID: optional,
    LINKEDIN_CLIENT_SECRET: optional,
    /** Microsoft (Entra ID) sign-in, for universities on Microsoft 365. Tenant "common" accepts any. */
    MICROSOFT_CLIENT_ID: optional,
    MICROSOFT_CLIENT_SECRET: optional,
    MICROSOFT_TENANT_ID: z.string().default("common"),
    STRIPE_SECRET_KEY: optional,
    STRIPE_WEBHOOK_SECRET: optional,
    /** Comma-separated emails that become admins when they sign up. */
    ADMIN_EMAILS: z
      .string()
      .default("")
      .transform((v) => v.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    API_CORS_ORIGINS: z
      .string()
      .default("http://localhost:3000")
      .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),
    DEV_AUTH: bool.default(false),
  });
export type ApiEnv = z.output<typeof ApiEnvSchema>;

export const WorkerEnvSchema = BaseEnvSchema.extend(DatabaseEnvSchema.shape)
  .extend(RedisEnvSchema.shape)
  .extend(AiEnvSchema.shape)
  .extend(StorageEnvSchema.shape)
  .extend(AppUrlEnvSchema.shape)
  .extend(JobFeedEnvSchema.shape)
  .extend({
    /** smtp://user:pass@host:587 — without it, emails are logged instead of sent. */
    SMTP_URL: optional,
    EMAIL_FROM: z.string().default("CV Builder <no-reply@cvbuilder.local>"),
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(64).default(5),
    /** Pays experts (Stripe Connect transfers) when orders complete on their own. */
    STRIPE_SECRET_KEY: optional,
    /** Who hears about overdue expert orders. Comma-separated. */
    ADMIN_EMAILS: z
      .string()
      .default("")
      .transform((v) => v.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)),
  });
export type WorkerEnv = z.output<typeof WorkerEnvSchema>;

export class EnvError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid environment:\n${issues.map((i) => `  - ${i}`).join("\n")}`);
    this.name = "EnvError";
  }
}

/** Parses `source` (default `process.env`) against `schema`, or throws an `EnvError` listing every problem. */
export function loadEnv<S extends z.ZodType>(schema: S, source: Record<string, unknown> = process.env): z.output<S> {
  const result = schema.safeParse(source);
  if (result.success) return result.data;
  throw new EnvError(result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`));
}
