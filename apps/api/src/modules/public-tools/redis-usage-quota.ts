import { Logger, type OnModuleDestroy } from "@nestjs/common";
import { Redis } from "ioredis";
import { InMemoryUsageQuota, type UsageQuota } from "./usage-quota.js";

/**
 * Redis adapter for UsageQuota: INCR with an absolute expiry, so every API process sees the same
 * count and keys vanish when the window ends. If Redis can't be reached the counts fall back to
 * this process's memory (still limited, just not shared) rather than failing the request.
 */
export class RedisUsageQuota implements UsageQuota, OnModuleDestroy {
  private readonly logger = new Logger(RedisUsageQuota.name);
  private readonly redis: Redis;
  private readonly fallback = new InMemoryUsageQuota();
  private connecting: Promise<void> | null = null;
  private lastWarn = 0;

  constructor(url: string) {
    this.redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false, connectTimeout: 2_000 });
    this.redis.on("error", () => {
      // Logged (at most once a minute) by the failed call below; ioredis keeps reconnecting on its own.
    });
  }

  async take(key: string, expiresAt: Date): Promise<number> {
    return this.safe(
      async () => {
        const res = await this.redis.multi().incr(key).pexpireat(key, expiresAt.getTime()).exec();
        const n = res?.[0]?.[1];
        if (typeof n !== "number") throw new Error("Unexpected INCR reply");
        return n;
      },
      () => this.fallback.take(key, expiresAt),
    );
  }

  async release(key: string): Promise<void> {
    await this.safe(
      async () => {
        const n = await this.redis.decr(key);
        if (n < 0) await this.redis.set(key, "0", "KEEPTTL");
      },
      () => this.fallback.release(key),
    );
  }

  async used(key: string): Promise<number> {
    return this.safe(
      async () => Number((await this.redis.get(key)) ?? 0),
      () => this.fallback.used(key),
    );
  }

  async onModuleDestroy(): Promise<void> {
    this.redis.disconnect();
  }

  private async safe<T>(fn: () => Promise<T>, otherwise: () => Promise<T>): Promise<T> {
    try {
      if (this.redis.status === "wait" || this.connecting) {
        this.connecting ??= this.redis.connect().finally(() => {
          this.connecting = null;
        });
        await this.connecting;
      }
      return await fn();
    } catch (e) {
      if (Date.now() - this.lastWarn > 60_000) {
        this.lastWarn = Date.now();
        this.logger.warn(`Redis unavailable for usage counts, using memory: ${e instanceof Error ? e.message : String(e)}`);
      }
      return otherwise();
    }
  }
}
