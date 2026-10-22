import { DB } from "@cvb/db/nest";
import { Prisma, type DbClient } from "@cvb/db";
import { Inject, Injectable } from "@nestjs/common";

export type ExpertRow = {
  userId: string;
  email: string;
  displayName: string;
  headline: string;
  bio: string;
  photoUrl: string | null;
  specialties: string[];
  languages: string[];
  services: string[];
  status: string;
  timezone: string;
  availability: unknown;
  maxActiveOrders: number;
  stripeAccountId: string | null;
  payoutsEnabled: boolean;
  ratingAvg: number;
  ratingCount: number;
  approvedAt: Date | null;
};

export type OrderRow = {
  id: string;
  userId: string;
  expertId: string | null;
  kind: string;
  status: string;
  resumeId: string | null;
  priceCents: number;
  currency: string;
  commissionCents: number;
  included: boolean;
  intake: Record<string, string>;
  dueAt: Date | null;
  scheduledAt: Date | null;
  durationMin: number | null;
  meetingUrl: string | null;
  deliveryNote: string;
  revisionsIncluded: number;
  revisionsUsed: number;
  rating: number | null;
  ratingComment: string;
  checkoutId: string | null;
  paymentId: string | null;
  refundId: string | null;
  transferId: string | null;
  refundReason: string;
  dispute: { reason: string; openedAt: string; resolution?: string; resolvedAt?: string } | null;
  paidAt: Date | null;
  assignedAt: Date | null;
  deliveredAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  buyer: { id: string; name: string; email: string };
  expert: { userId: string; displayName: string; photoUrl: string | null; email: string; stripeAccountId: string | null; payoutsEnabled: boolean } | null;
  resumeTitle: string | null;
};

export type OrderPatch = Partial<
  Omit<OrderRow, "id" | "userId" | "kind" | "createdAt" | "buyer" | "expert" | "resumeTitle" | "dispute"> & { dispute: OrderRow["dispute"] }
>;
export type NewOrder = Pick<OrderRow, "userId" | "expertId" | "kind" | "resumeId" | "priceCents" | "currency" | "commissionCents" | "included" | "intake" | "scheduledAt" | "durationMin" | "revisionsIncluded">;
export type MessageRow = { id: string; orderId: string; authorId: string; authorName: string; body: string; createdAt: Date };

/** Persistence for expert profiles and orders. A port so the order rules are testable in memory. */
export interface OrdersStore {
  expert(userId: string): Promise<ExpertRow | null>;
  experts(filter: { status?: string; service?: string }): Promise<ExpertRow[]>;
  saveExpert(userId: string, data: Partial<Omit<ExpertRow, "userId" | "email">>): Promise<ExpertRow>;
  activeCounts(expertIds: string[], statuses: string[]): Promise<Map<string, number>>;
  /** Coaching sessions that block an expert's calendar. */
  bookings(expertId: string, from: Date): Promise<{ start: Date; end: Date }[]>;
  includedSince(userId: string, since: Date): Promise<number>;
  resume(userId: string, resumeId: string): Promise<{ id: string; title: string } | null>;
  user(userId: string): Promise<{ id: string; name: string; email: string } | null>;
  createOrder(data: NewOrder): Promise<OrderRow>;
  order(id: string): Promise<OrderRow | null>;
  /** Updates only while the order is in one of `from` (compare-and-set); null when it wasn't. */
  updateOrder(id: string, patch: OrderPatch, from?: string[]): Promise<OrderRow | null>;
  orders(where: { userId?: string; expertId?: string; status?: string }): Promise<OrderRow[]>;
  messages(orderId: string): Promise<MessageRow[]>;
  addMessage(orderId: string, authorId: string, body: string): Promise<MessageRow>;
}

export const ORDERS_STORE = Symbol.for("cvb.api.OrdersStore");

const orderInclude = {
  user: { select: { id: true, name: true, email: true } },
  expert: { select: { userId: true, displayName: true, photoUrl: true, stripeAccountId: true, payoutsEnabled: true, user: { select: { email: true } } } },
  resume: { select: { title: true } },
} satisfies Prisma.ServiceOrderInclude;

type OrderWith = Prisma.ServiceOrderGetPayload<{ include: typeof orderInclude }>;

const toOrder = (o: OrderWith): OrderRow => ({
  id: o.id,
  userId: o.userId,
  expertId: o.expertId,
  kind: o.kind,
  status: o.status,
  resumeId: o.resumeId,
  priceCents: o.priceCents,
  currency: o.currency,
  commissionCents: o.commissionCents,
  included: o.included,
  intake: (o.intake ?? {}) as Record<string, string>,
  dueAt: o.dueAt,
  scheduledAt: o.scheduledAt,
  durationMin: o.durationMin,
  meetingUrl: o.meetingUrl,
  deliveryNote: o.deliveryNote,
  revisionsIncluded: o.revisionsIncluded,
  revisionsUsed: o.revisionsUsed,
  rating: o.rating,
  ratingComment: o.ratingComment,
  checkoutId: o.checkoutId,
  paymentId: o.paymentId,
  refundId: o.refundId,
  transferId: o.transferId,
  refundReason: o.refundReason,
  dispute: (o.dispute ?? null) as OrderRow["dispute"],
  paidAt: o.paidAt,
  assignedAt: o.assignedAt,
  deliveredAt: o.deliveredAt,
  completedAt: o.completedAt,
  cancelledAt: o.cancelledAt,
  createdAt: o.createdAt,
  buyer: o.user,
  expert: o.expert
    ? {
        userId: o.expert.userId,
        displayName: o.expert.displayName,
        photoUrl: o.expert.photoUrl,
        email: o.expert.user.email,
        stripeAccountId: o.expert.stripeAccountId,
        payoutsEnabled: o.expert.payoutsEnabled,
      }
    : null,
  resumeTitle: o.resume?.title ?? null,
});

const expertSelect = {
  userId: true,
  displayName: true,
  headline: true,
  bio: true,
  photoUrl: true,
  specialties: true,
  languages: true,
  services: true,
  status: true,
  timezone: true,
  availability: true,
  maxActiveOrders: true,
  stripeAccountId: true,
  payoutsEnabled: true,
  ratingAvg: true,
  ratingCount: true,
  approvedAt: true,
  user: { select: { email: true } },
} satisfies Prisma.ExpertProfileSelect;

type ExpertWith = Prisma.ExpertProfileGetPayload<{ select: typeof expertSelect }>;
const toExpert = ({ user, ...e }: ExpertWith): ExpertRow => ({ ...e, email: user.email });

const COACHING_BLOCKING = ["paid", "in_progress", "delivered", "disputed"];

@Injectable()
export class PrismaOrdersStore implements OrdersStore {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async expert(userId: string) {
    const e = await this.db.expertProfile.findUnique({ where: { userId }, select: expertSelect });
    return e && toExpert(e);
  }

  async experts(filter: { status?: string; service?: string }) {
    const rows = await this.db.expertProfile.findMany({
      where: { ...(filter.status ? { status: filter.status } : {}), ...(filter.service ? { services: { has: filter.service } } : {}), user: { deletedAt: null } },
      select: expertSelect,
      orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }, { createdAt: "asc" }],
      take: 500,
    });
    return rows.map(toExpert);
  }

  async saveExpert(userId: string, data: Partial<Omit<ExpertRow, "userId" | "email">>) {
    const { availability, ...rest } = data;
    const json = availability === undefined ? {} : { availability: availability as Prisma.InputJsonValue };
    const row = await this.db.expertProfile.upsert({
      where: { userId },
      create: { userId, displayName: rest.displayName ?? "Expert", ...rest, ...json },
      update: { ...rest, ...json },
      select: expertSelect,
    });
    return toExpert(row);
  }

  async activeCounts(expertIds: string[], statuses: string[]) {
    const rows = await this.db.serviceOrder.groupBy({ by: ["expertId"], where: { expertId: { in: expertIds }, status: { in: statuses } }, _count: { _all: true } });
    return new Map(rows.map((r) => [r.expertId!, r._count._all]));
  }

  async bookings(expertId: string, from: Date) {
    const rows = await this.db.serviceOrder.findMany({
      where: {
        expertId,
        kind: "coaching",
        scheduledAt: { gte: new Date(from.getTime() - 3 * 3600_000) },
        OR: [{ status: { in: COACHING_BLOCKING } }, { status: "pending_payment", createdAt: { gte: new Date(Date.now() - 30 * 60_000) } }],
      },
      select: { scheduledAt: true, durationMin: true },
    });
    return rows.map((r) => ({ start: r.scheduledAt!, end: new Date(r.scheduledAt!.getTime() + (r.durationMin ?? 60) * 60_000) }));
  }

  includedSince(userId: string, since: Date) {
    return this.db.serviceOrder.count({ where: { userId, included: true, createdAt: { gte: since }, status: { notIn: ["cancelled", "refunded"] } } });
  }

  resume(userId: string, resumeId: string) {
    return this.db.resume.findFirst({ where: { id: resumeId, userId, deletedAt: null }, select: { id: true, title: true } });
  }

  user(userId: string) {
    return this.db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
  }

  async createOrder(data: NewOrder) {
    return toOrder(await this.db.serviceOrder.create({ data: { ...data, intake: data.intake }, include: orderInclude }));
  }

  async order(id: string) {
    const o = await this.db.serviceOrder.findUnique({ where: { id }, include: orderInclude });
    return o && toOrder(o);
  }

  async updateOrder(id: string, patch: OrderPatch, from?: string[]) {
    const { dispute, intake, ...rest } = patch;
    const data: Prisma.ServiceOrderUncheckedUpdateManyInput = {
      ...rest,
      ...(intake !== undefined ? { intake } : {}),
      ...(dispute !== undefined ? { dispute: dispute === null ? Prisma.DbNull : dispute } : {}),
    };
    const { count } = await this.db.serviceOrder.updateMany({ where: { id, ...(from ? { status: { in: from } } : {}) }, data });
    return count ? this.order(id) : null;
  }

  async orders(where: { userId?: string; expertId?: string; status?: string }) {
    const rows = await this.db.serviceOrder.findMany({ where, include: orderInclude, orderBy: { createdAt: "desc" }, take: 500 });
    return rows.map(toOrder);
  }

  async messages(orderId: string) {
    const rows = await this.db.orderMessage.findMany({ where: { orderId }, include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } });
    return rows.map((m) => ({ id: m.id, orderId: m.orderId, authorId: m.authorId, authorName: m.author.name, body: m.body, createdAt: m.createdAt }));
  }

  async addMessage(orderId: string, authorId: string, body: string) {
    const m = await this.db.orderMessage.create({ data: { orderId, authorId, body }, include: { author: { select: { name: true } } } });
    return { id: m.id, orderId: m.orderId, authorId: m.authorId, authorName: m.author.name, body: m.body, createdAt: m.createdAt };
  }
}
