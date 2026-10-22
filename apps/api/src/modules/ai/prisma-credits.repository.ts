import { DB } from "@cvb/db/nest";
import type { DbClient } from "@cvb/db";
import { Inject, Injectable } from "@nestjs/common";
import type { CreditsRepository } from "./credits.repository.js";

/** Ledger reasons: "ai:<task>:allowance", "ai:<task>:purchased", "purchase:<ref>", "grant:<why>". */
@Injectable()
export class PrismaCreditsRepository implements CreditsRepository {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async usage(userId: string, since: Date) {
    const [month, purchased, purchasedUsed] = await Promise.all([
      this.db.creditLedger.aggregate({ where: { userId, createdAt: { gte: since }, reason: { endsWith: ":allowance" } }, _sum: { delta: true } }),
      this.db.creditLedger.aggregate({ where: { userId, delta: { gt: 0 } }, _sum: { delta: true } }),
      this.db.creditLedger.aggregate({ where: { userId, reason: { endsWith: ":purchased" } }, _sum: { delta: true } }),
    ]);
    return {
      usedThisMonth: -(month._sum.delta ?? 0),
      purchased: purchased._sum.delta ?? 0,
      purchasedUsed: -(purchasedUsed._sum.delta ?? 0),
    };
  }

  async spend({ userId, amount, task, pool }: { userId: string; amount: number; task: string; pool: "allowance" | "purchased" }) {
    await this.db.creditLedger.create({ data: { userId, delta: -amount, reason: `ai:${task}:${pool}` } });
  }
}
