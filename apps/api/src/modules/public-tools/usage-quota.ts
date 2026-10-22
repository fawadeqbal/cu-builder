import { createHash } from "node:crypto";

/**
 * Port: counts uses of a free allowance per visitor and window (free AI writing tools). The
 * Redis adapter shares counts between API processes; the in-memory one serves tests and the
 * moment Redis is unreachable.
 */
export interface UsageQuota {
  /** Takes one use. Returns the uses counted in the window including this one. */
  take(key: string, expiresAt: Date): Promise<number>;
  /** Gives one use back (the call it paid for failed, or it went over the limit). */
  release(key: string): Promise<void>;
  /** Uses counted so far in the window. */
  used(key: string): Promise<number>;
}

export const USAGE_QUOTA = Symbol.for("cvb.api.UsageQuota");

/** The daily window: the UTC date and the next midnight, when the allowance starts again. */
export function dailyWindow(now: Date): { day: string; resetsAt: Date } {
  const day = now.toISOString().slice(0, 10);
  const resetsAt = new Date(`${day}T00:00:00.000Z`);
  resetsAt.setUTCDate(resetsAt.getUTCDate() + 1);
  return { day, resetsAt };
}

/** Quota key for a visitor: a hash of the IP with the day, so no raw address is ever stored. */
export const visitorKey = (scope: string, ip: string, day: string) =>
  `quota:${scope}:${day}:${createHash("sha256").update(`${day}|${ip}`).digest("hex").slice(0, 32)}`;

export class InMemoryUsageQuota implements UsageQuota {
  private readonly counts = new Map<string, { n: number; expiresAt: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  async take(key: string, expiresAt: Date): Promise<number> {
    this.sweep();
    const entry = this.counts.get(key) ?? { n: 0, expiresAt: expiresAt.getTime() };
    entry.n += 1;
    this.counts.set(key, entry);
    return entry.n;
  }

  async release(key: string): Promise<void> {
    const entry = this.counts.get(key);
    if (entry && entry.n > 0) entry.n -= 1;
  }

  async used(key: string): Promise<number> {
    this.sweep();
    return this.counts.get(key)?.n ?? 0;
  }

  private sweep() {
    const t = this.now();
    for (const [k, v] of this.counts) if (v.expiresAt <= t) this.counts.delete(k);
  }
}
