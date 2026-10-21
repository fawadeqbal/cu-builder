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

export const ApiEnvSchema = BaseEnvSchema.extend(DatabaseEnvSchema.shape)
  .extend(RedisEnvSchema.shape)
  .extend({
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
  .extend({
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
