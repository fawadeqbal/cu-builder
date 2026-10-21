import { describe, expect, it } from "vitest";
import { ApiEnvSchema, EnvError, loadEnv } from "./index";

describe("loadEnv", () => {
  it("parses and applies defaults", () => {
    const env = loadEnv(ApiEnvSchema, {
      DATABASE_URL: "postgresql://u:p@localhost:5432/db",
      REDIS_URL: "redis://localhost:6379",
      API_CORS_ORIGINS: "http://a.test, http://b.test",
      DEV_AUTH: "true",
    });
    expect(env.API_PORT).toBe(4000);
    expect(env.API_CORS_ORIGINS).toEqual(["http://a.test", "http://b.test"]);
    expect(env.DEV_AUTH).toBe(true);
  });

  it("lists every problem", () => {
    expect(() => loadEnv(ApiEnvSchema, { DATABASE_URL: "mysql://x" })).toThrow(EnvError);
  });
});
