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

/** Claude for AI writing. Without a key the app uses a deterministic offline assistant. */
export const AiEnvSchema = z.object({
  ANTHROPIC_API_KEY: optional,
  AI_MODEL_FAST: z.string().default("claude-haiku-5-5"),
  AI_MODEL_SMART: z.string().default("claude-sonnet-5-5"),
});

/** Job feed providers. Remotive needs no key; Jooble and Adzuna switch on when their keys are set. */
export const JobFeedEnvSchema = z.object({
  JOOBLE_API_KEY: optional,
  ADZUNA_APP_ID: optional,
  ADZUNA_APP_KEY: optional,
  ADZUNA_COUNTRY: z.string().length(2).default("gb"),
});

export const ApiEnvSchema = BaseEnvSchema.extend(DatabaseEnvSchema.shape)
  .extend(RedisEnvSchema.shape)
  .extend(StorageEnvSchema.shape)
  .extend(AppUrlEnvSchema.shape)
  .extend(AiEnvSchema.shape)
  .extend(JobFeedEnvSchema.shape)
  .extend({
    BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
    GOOGLE_CLIENT_ID: optional,
    GOOGLE_CLIENT_SECRET: optional,
    LINKEDIN_CLIENT_ID: optional,
    LINKEDIN_CLIENT_SECRET: optional,
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
  .extend(StorageEnvSchema.shape)
  .extend(AppUrlEnvSchema.shape)
  .extend(JobFeedEnvSchema.shape)
  .extend({
    /** smtp://user:pass@host:587 — without it, emails are logged instead of sent. */
    SMTP_URL: optional,
    EMAIL_FROM: z.string().default("CV Builder <no-reply@cvbuilder.local>"),
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(64).default(5),
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
