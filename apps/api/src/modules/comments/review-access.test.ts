import type { DbClient } from "@cvb/db";
import { describe, expect, it } from "vitest";
import { reviewAccess } from "./review-access.js";

/** Fake Prisma: one CV owned by "owner"; an expert order; an org with a reviewer and the owner. */
function db(opts: { orderStatus?: string } = {}) {
  return {
    resume: { findFirst: async ({ where }: { where: { id: string } }) => (where.id === "r1" ? { userId: "owner" } : null) },
    serviceOrder: {
      findFirst: async ({ where }: { where: { expertId: string; status: { in: string[] } } }) =>
        where.expertId === "expert" && where.status.in.includes(opts.orderStatus ?? "paid") ? { id: "o1" } : null,
    },
    membership: {
      findFirst: async ({ where }: { where: { userId: string; role: { in: string[] } } }) =>
        where.userId === "reviewer" && where.role.in.includes("reviewer") ? { orgId: "org1" } : null,
    },
  } as unknown as DbClient;
}

describe("reviewAccess", () => {
  it("lets the owner, the assigned expert and the career office in, nobody else", async () => {
    expect(await reviewAccess(db(), "owner", "r1")).toEqual({ role: "owner" });
    expect(await reviewAccess(db(), "expert", "r1")).toEqual({ role: "expert", orderId: "o1" });
    expect(await reviewAccess(db(), "reviewer", "r1")).toEqual({ role: "org-reviewer", orgId: "org1" });
    expect(await reviewAccess(db(), "stranger", "r1")).toBeNull();
    expect(await reviewAccess(db(), "owner", "missing")).toBeNull();
  });

  it("closes the door on experts once an order is cancelled or refunded", async () => {
    expect(await reviewAccess(db({ orderStatus: "refunded" }), "expert", "r1")).toBeNull();
  });
});
