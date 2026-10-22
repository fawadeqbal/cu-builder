import { DB } from "@cvb/db/nest";
import type { DbClient } from "@cvb/db";
import { Inject, Injectable } from "@nestjs/common";

export type DueOrder = {
  id: string;
  kind: string;
  dueAt: Date;
  expert: { email: string; displayName: string } | null;
};

export type StaleDelivery = {
  id: string;
  kind: string;
  priceCents: number;
  included: boolean;
  durationMin: number | null;
  currency: string;
  buyer: { email: string; name: string };
  expert: { email: string; displayName: string; stripeAccountId: string | null; payoutsEnabled: boolean } | null;
};

/** What the expert-order jobs read and change. A port so the rules are testable without a database. */
export interface ServiceOrdersStore {
  /** Open orders (paid / in progress) due before `before`. */
  dueBefore(before: Date): Promise<DueOrder[]>;
  /** Delivered orders the buyer hasn't answered since `deliveredBefore`. */
  staleDeliveries(deliveredBefore: Date): Promise<StaleDelivery[]>;
  /** Completes a delivered order; false when it changed meanwhile. */
  complete(id: string, at: Date): Promise<boolean>;
  setTransfer(id: string, transferId: string): Promise<void>;
}

export const SERVICE_ORDERS_STORE = Symbol.for("cvb.worker.ServiceOrdersStore");

@Injectable()
export class PrismaServiceOrdersStore implements ServiceOrdersStore {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async dueBefore(before: Date): Promise<DueOrder[]> {
    const rows = await this.db.serviceOrder.findMany({
      where: { status: { in: ["paid", "in_progress"] }, kind: { not: "coaching" }, dueAt: { lte: before } },
      select: { id: true, kind: true, dueAt: true, expert: { select: { displayName: true, user: { select: { email: true } } } } },
      take: 500,
    });
    return rows.map((r) => ({ id: r.id, kind: r.kind, dueAt: r.dueAt!, expert: r.expert && { email: r.expert.user.email, displayName: r.expert.displayName } }));
  }

  async staleDeliveries(deliveredBefore: Date): Promise<StaleDelivery[]> {
    const rows = await this.db.serviceOrder.findMany({
      where: { status: "delivered", deliveredAt: { lte: deliveredBefore } },
      select: {
        id: true,
        kind: true,
        priceCents: true,
        included: true,
        durationMin: true,
        currency: true,
        user: { select: { email: true, name: true } },
        expert: { select: { displayName: true, stripeAccountId: true, payoutsEnabled: true, user: { select: { email: true } } } },
      },
      take: 500,
    });
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      priceCents: r.priceCents,
      included: r.included,
      durationMin: r.durationMin,
      currency: r.currency,
      buyer: r.user,
      expert: r.expert && { email: r.expert.user.email, displayName: r.expert.displayName, stripeAccountId: r.expert.stripeAccountId, payoutsEnabled: r.expert.payoutsEnabled },
    }));
  }

  async complete(id: string, at: Date): Promise<boolean> {
    const { count } = await this.db.serviceOrder.updateMany({ where: { id, status: "delivered" }, data: { status: "completed", completedAt: at } });
    return count > 0;
  }

  async setTransfer(id: string, transferId: string): Promise<void> {
    await this.db.serviceOrder.update({ where: { id }, data: { transferId } });
  }
}
