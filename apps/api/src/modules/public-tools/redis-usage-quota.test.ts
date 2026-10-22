import { describe, expect, it } from "vitest";
import { RedisUsageQuota } from "./redis-usage-quota.js";

describe("RedisUsageQuota", () => {
  it("keeps counting in memory when Redis can't be reached", async () => {
    const quota = new RedisUsageQuota("redis://127.0.0.1:1");
    try {
      const until = new Date(Date.now() + 60_000);
      expect(await quota.take("k", until)).toBe(1);
      expect(await quota.take("k", until)).toBe(2);
      await quota.release("k");
      expect(await quota.used("k")).toBe(1);
    } finally {
      await quota.onModuleDestroy();
    }
  });
});
