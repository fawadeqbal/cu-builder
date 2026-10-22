import type { CreateOrderDto, EmailJob, OrderDto, OrderMessageDto, ResolveDisputeDto } from "@cvb/contracts";
import { QUEUES } from "@cvb/contracts";
import {
  ACTIVE_STATUSES,
  SERVICES,
  assertTransition,
  availableSlots,
  dueDate,
  googleCalendarUrl,
  icsEvent,
  includedReviewAvailable,
  isSlotAvailable,
  missingIntake,
  monthStartUtc,
  nextRating,
  priceFor,
  splitPayment,
  type OrderStatus,
  type ServiceKind,
  type WeeklyWindow,
} from "@cvb/domain";
import { JOB_PRODUCER, type JobProducer } from "@cvb/queue";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@cvb/shared";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { APP_CONFIG, type AppConfig } from "../../config/app-config.js";
import { ORDERS_STORE, type ExpertRow, type OrderPatch, type OrderRow, type OrdersStore } from "./orders.store.js";
import { SERVICE_PAYMENTS, type ServicePayments } from "./service-payments.js";

type Viewer = "buyer" | "expert" | "admin";

const iso = (d: Date | null) => d?.toISOString() ?? null;

/** The domain's transition check, as a 400 the person can read. */
function allow(from: string, to: OrderStatus) {
  try {
    assertTransition(from, to);
  } catch (e) {
    throw new ValidationError(e instanceof Error ? e.message : "That isn't possible for this order now");
  }
}
const MIN = 60_000;

/**
 * Expert service orders: buying (checkout, or included in Executive), assignment, the expert's
 * work, the buyer's acceptance, revisions, disputes, refunds and the expert's payout.
 * Every status change goes through the domain's transition table.
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @Inject(ORDERS_STORE) private readonly store: OrdersStore,
    @Inject(SERVICE_PAYMENTS) private readonly payments: ServicePayments,
    @Inject(JOB_PRODUCER) private readonly jobs: JobProducer,
    @Inject(APP_CONFIG) private readonly config: Pick<AppConfig, "APP_URL" | "ADMIN_EMAILS">,
  ) {}

  catalog() {
    return Object.values(SERVICES);
  }

  /** Whether the user's plan still includes a review this month. */
  async includedAvailable(user: AuthUser): Promise<boolean> {
    return includedReviewAvailable(user.plan, "review", await this.store.includedSince(user.id, monthStartUtc(new Date())));
  }

  async create(user: AuthUser, dto: CreateOrderDto, now = new Date()): Promise<{ order: OrderDto; checkoutUrl: string | null }> {
    const kind = dto.kind as ServiceKind;
    const info = SERVICES[kind];
    let expert: ExpertRow | null = null;
    if (dto.expertId) {
      expert = await this.store.expert(dto.expertId);
      if (!expert || expert.status !== "approved" || !expert.services.includes(info.service)) throw new ValidationError("This expert doesn't offer that service");
      if (expert.userId === user.id) throw new ValidationError("You can't order from yourself");
    }
    let resumeId: string | null = null;
    if (info.needsResume) {
      if (!dto.resumeId) throw new ValidationError("Choose the CV for the expert to work on");
      const resume = await this.store.resume(user.id, dto.resumeId);
      if (!resume) throw new NotFoundError("Resume", dto.resumeId);
      resumeId = resume.id;
    }
    const intake = Object.fromEntries(Object.entries(dto.intake).map(([k, v]) => [k, v.trim()]));
    const missing = missingIntake(kind, intake);
    if (missing.length) throw new ValidationError(`Please answer: ${missing.join("; ")}`);

    let scheduledAt: Date | null = null;
    let durationMin: number | null = null;
    if (kind === "coaching") {
      if (!expert) throw new ValidationError("Choose a coach for the session");
      if (!dto.scheduledAt) throw new ValidationError("Choose a time for the session");
      durationMin = dto.durationMin ?? 60;
      scheduledAt = new Date(dto.scheduledAt);
      const slots = availableSlots({
        windows: (expert.availability as WeeklyWindow[]) ?? [],
        timeZone: expert.timezone,
        durationMin,
        now,
        booked: await this.store.bookings(expert.userId, now),
      });
      if (!isSlotAvailable(slots, scheduledAt)) throw new ConflictError("That time was just taken. Please choose another.");
    }

    const included = includedReviewAvailable(user.plan, kind, await this.store.includedSince(user.id, monthStartUtc(now)));
    const priceCents = included ? 0 : priceFor(kind, { durationMin: durationMin ?? undefined });
    const order = await this.store.createOrder({
      userId: user.id,
      expertId: expert?.userId ?? null,
      kind,
      resumeId,
      priceCents,
      currency: "usd",
      commissionCents: splitPayment(priceCents).commissionCents,
      included,
      intake,
      scheduledAt,
      durationMin,
      revisionsIncluded: info.revisions,
    });

    if (included) {
      return { order: this.toDto(await this.markPaid(order.id, null, now), "buyer"), checkoutUrl: null };
    }
    const checkout = await this.payments.checkout({
      orderId: order.id,
      userId: user.id,
      name: expert ? `${info.name} with ${expert.displayName}` : info.name,
      priceCents,
      currency: order.currency,
      email: user.email,
      successUrl: `${this.config.APP_URL}/orders/${order.id}?paid=1`,
      cancelUrl: `${this.config.APP_URL}/orders/${order.id}?cancelled=1`,
    });
    if (checkout.paidNow) {
      return { order: this.toDto(await this.markPaid(order.id, `dev_${order.id}`, now), "buyer"), checkoutUrl: null };
    }
    await this.store.updateOrder(order.id, { checkoutId: checkout.checkoutId });
    return { order: this.toDto(order, "buyer"), checkoutUrl: checkout.url };
  }

  /**
   * Payment confirmed (webhook, dev payment or included in the plan). Idempotent: only a
   * pending order moves. Assigns an expert, sets the deadline and tells both sides.
   */
  async markPaid(orderId: string, paymentRef: string | null, now = new Date()): Promise<OrderRow> {
    const current = await this.store.order(orderId);
    if (!current) throw new NotFoundError("Order", orderId);
    if (current.status !== "pending_payment") return current;
    const kind = current.kind as ServiceKind;
    const expertId = current.expertId ?? (await this.pickExpert(kind, current.userId))?.userId ?? null;
    const paid = await this.store.updateOrder(
      orderId,
      {
        status: "paid",
        paymentId: paymentRef,
        paidAt: now,
        expertId,
        assignedAt: expertId ? now : null,
        dueAt: dueDate(kind, now, current.scheduledAt),
        meetingUrl: kind === "coaching" ? `https://meet.jit.si/cvb-${orderId}` : null,
      },
      ["pending_payment"],
    );
    if (!paid) return (await this.store.order(orderId))!;
    const info = SERVICES[kind];
    await this.email(`paid-${orderId}`, paid.buyer.email, paid.buyer.name, {
      subject: `Order confirmed: ${info.name}`,
      lines: [
        paid.included ? "This one is included in your plan." : "Thanks, your payment went through.",
        paid.expert ? `${paid.expert.displayName} will work on it.` : "We're matching you with an expert now.",
        ...(paid.dueAt && kind !== "coaching" ? [`Expected by ${paid.dueAt.toUTCString()}.`] : []),
        ...(paid.scheduledAt ? [`Your session: ${paid.scheduledAt.toUTCString()}. Join at ${paid.meetingUrl}.`] : []),
      ],
      action: { label: "Open your order", url: `${this.config.APP_URL}/orders/${orderId}` },
    });
    if (paid.expert) await this.notifyAssigned(paid);
    else await this.notifyAdmins(`unassigned-${orderId}`, `No expert available for order ${orderId}`, [`A paid ${info.name} needs an expert. Assign one on the admin page.`]);
    return paid;
  }

  /** Least busy approved expert offering the service, with spare capacity. */
  private async pickExpert(kind: ServiceKind, buyerId: string): Promise<ExpertRow | null> {
    const experts = (await this.store.experts({ status: "approved", service: SERVICES[kind].service })).filter((e) => e.userId !== buyerId);
    if (!experts.length) return null;
    const load = await this.store.activeCounts(
      experts.map((e) => e.userId),
      ACTIVE_STATUSES,
    );
    return (
      experts
        .filter((e) => (load.get(e.userId) ?? 0) < e.maxActiveOrders)
        .sort((a, b) => (load.get(a.userId) ?? 0) - (load.get(b.userId) ?? 0) || b.ratingAvg - a.ratingAvg)[0] ?? null
    );
  }

  private async notifyAssigned(order: OrderRow) {
    const info = SERVICES[order.kind as ServiceKind];
    await this.email(`assigned-${order.id}-${order.expertId}`, order.expert!.email, order.expert!.displayName, {
      subject: `New order: ${info.name}`,
      lines: [
        `${order.buyer.name || "A customer"} ordered ${info.name.toLowerCase()}.`,
        order.dueAt ? `Due ${order.dueAt.toUTCString()}.` : "",
        `Your share: $${(splitPayment(this.listPrice(order)).expertCents / 100).toFixed(2)} when the order completes.`,
      ].filter(Boolean),
      action: { label: "Open the order", url: `${this.config.APP_URL}/orders/${order.id}` },
    });
  }

  // ─── Reading ─────────────────────────────────────────────

  async mine(user: AuthUser): Promise<OrderDto[]> {
    return (await this.store.orders({ userId: user.id })).map((o) => this.toDto(o, "buyer"));
  }

  async assigned(user: AuthUser): Promise<OrderDto[]> {
    return (await this.store.orders({ expertId: user.id })).filter((o) => o.status !== "pending_payment").map((o) => this.toDto(o, "expert"));
  }

  async all(status?: string): Promise<OrderDto[]> {
    return (await this.store.orders(status ? { status } : {})).map((o) => this.toDto(o, "admin"));
  }

  async get(user: AuthUser, id: string): Promise<OrderDto> {
    const { order, viewer } = await this.visible(user, id);
    return this.toDto(order, viewer);
  }

  async messages(user: AuthUser, id: string): Promise<OrderMessageDto[]> {
    await this.visible(user, id);
    return (await this.store.messages(id)).map((m) => ({ id: m.id, authorId: m.authorId, authorName: m.authorName, mine: m.authorId === user.id, body: m.body, createdAt: m.createdAt.toISOString() }));
  }

  async postMessage(user: AuthUser, id: string, body: string): Promise<OrderMessageDto> {
    const { order, viewer } = await this.visible(user, id);
    if (order.status === "pending_payment" || order.status === "cancelled") throw new ValidationError("Messages open once the order is paid");
    const m = await this.store.addMessage(id, user.id, body);
    const to = viewer === "buyer" ? order.expert && { email: order.expert.email, name: order.expert.displayName } : { email: order.buyer.email, name: order.buyer.name };
    if (to) {
      await this.email(`msg-${id}-${Math.floor(Date.now() / 600_000)}-${viewer}`, to.email, to.name, {
        subject: `New message about your ${SERVICES[order.kind as ServiceKind].name.toLowerCase()}`,
        lines: [`${m.authorName}: ${body.slice(0, 600)}`],
        action: { label: "Reply", url: `${this.config.APP_URL}/orders/${id}` },
      });
    }
    return { id: m.id, authorId: m.authorId, authorName: m.authorName, mine: true, body: m.body, createdAt: m.createdAt.toISOString() };
  }

  /** The coaching session as a calendar file. */
  async calendar(user: AuthUser, id: string): Promise<string> {
    const { order } = await this.visible(user, id);
    if (!order.scheduledAt) throw new ValidationError("This order has no session time");
    const end = new Date(order.scheduledAt.getTime() + (order.durationMin ?? 60) * MIN);
    return icsEvent({
      uid: `${order.id}@cvbuilder`,
      start: order.scheduledAt,
      end,
      title: `Coaching session${order.expert ? ` with ${order.expert.displayName}` : ""}`,
      description: `Join the video call: ${order.meetingUrl ?? ""}\nOrder: ${this.config.APP_URL}/orders/${order.id}`,
      url: order.meetingUrl ?? undefined,
    });
  }

  // ─── Expert actions ──────────────────────────────────────

  async start(user: AuthUser, id: string): Promise<OrderDto> {
    const order = await this.asExpert(user, id);
    return this.toDto(await this.move(order, "in_progress", {}), "expert");
  }

  async deliver(user: AuthUser, id: string, note: string, now = new Date()): Promise<OrderDto> {
    const order = await this.asExpert(user, id);
    const done = await this.move(order, "delivered", { deliveryNote: note, deliveredAt: now });
    await this.email(`delivered-${id}-${done.revisionsUsed}`, done.buyer.email, done.buyer.name, {
      subject: `Your ${SERVICES[done.kind as ServiceKind].name.toLowerCase()} is ready`,
      lines: [
        `${done.expert?.displayName ?? "Your expert"} has delivered.`,
        done.resumeId ? "Their comments are next to your CV lines in the editor." : "",
        "Please accept it and leave a rating, or ask for changes.",
      ].filter(Boolean),
      action: { label: "See the delivery", url: `${this.config.APP_URL}/orders/${id}` },
    });
    return this.toDto(done, "expert");
  }

  /** Coaching notes (or an updated delivery note) saved on the order for the buyer. */
  async saveNotes(user: AuthUser, id: string, notes: string): Promise<OrderDto> {
    const order = await this.asExpert(user, id);
    if (order.status === "pending_payment" || order.status === "cancelled" || order.status === "refunded") throw new ValidationError("This order can't be changed now");
    return this.toDto((await this.store.updateOrder(id, { deliveryNote: notes }))!, "expert");
  }

  // ─── Buyer actions ───────────────────────────────────────

  async complete(user: AuthUser, id: string, rating: number, comment: string, now = new Date()): Promise<OrderDto> {
    const order = await this.asBuyer(user, id);
    const done = await this.move(order, "completed", { completedAt: now, rating, ratingComment: comment });
    if (done.expertId) {
      const expert = await this.store.expert(done.expertId);
      if (expert) {
        const r = nextRating(expert.ratingAvg, expert.ratingCount, rating);
        await this.store.saveExpert(expert.userId, { ratingAvg: r.avg, ratingCount: r.count });
      }
    }
    return this.toDto(await this.payout(done), "buyer");
  }

  async requestRevision(user: AuthUser, id: string, request: string): Promise<OrderDto> {
    const order = await this.asBuyer(user, id);
    if (order.revisionsUsed >= order.revisionsIncluded) throw new ValidationError(order.revisionsIncluded ? "You've used the included revision rounds" : "This service doesn't include revisions");
    const next = await this.move(order, "in_progress", { revisionsUsed: order.revisionsUsed + 1 });
    await this.store.addMessage(id, user.id, `Revision request: ${request}`);
    if (next.expert) {
      await this.email(`revision-${id}-${next.revisionsUsed}`, next.expert.email, next.expert.displayName, {
        subject: "Revision requested",
        lines: [request.slice(0, 1000)],
        action: { label: "Open the order", url: `${this.config.APP_URL}/orders/${id}` },
      });
    }
    return this.toDto(next, "buyer");
  }

  async dispute(user: AuthUser, id: string, reason: string, now = new Date()): Promise<OrderDto> {
    const order = await this.asBuyer(user, id);
    const next = await this.move(order, "disputed", { dispute: { reason, openedAt: now.toISOString() } });
    await this.notifyAdmins(`dispute-${id}`, `Dispute opened on order ${id}`, [reason.slice(0, 1000), `${this.config.APP_URL}/admin?tab=experts`]);
    return this.toDto(next, "buyer");
  }

  async cancel(user: AuthUser, id: string, now = new Date()): Promise<OrderDto> {
    const order = await this.asBuyer(user, id);
    return this.toDto(await this.move(order, "cancelled", { cancelledAt: now }), "buyer");
  }

  // ─── Admin ───────────────────────────────────────────────

  async refund(id: string, input: { amountCents?: number; reason: string }): Promise<OrderDto> {
    const order = await this.found(id);
    if (input.amountCents && input.amountCents > order.priceCents) throw new ValidationError("That's more than was paid");
    allow(order.status, "refunded");
    const refundId = order.priceCents > 0 ? await this.payments.refund(order.paymentId, input.amountCents) : null;
    const next = await this.move(order, "refunded", { refundId, refundReason: input.reason });
    await this.email(`refund-${id}`, next.buyer.email, next.buyer.name, {
      subject: "Your refund",
      lines: [
        `We've refunded ${input.amountCents ? `$${(input.amountCents / 100).toFixed(2)}` : "your order"}.`,
        input.reason,
        "Card refunds take 5–10 days to appear.",
      ],
    });
    return this.toDto(next, "admin");
  }

  async resolveDispute(id: string, input: ResolveDisputeDto, now = new Date()): Promise<OrderDto> {
    const order = await this.found(id);
    if (order.status !== "disputed") throw new ValidationError("This order isn't disputed");
    const dispute = { ...order.dispute!, resolution: `${input.outcome}: ${input.note}`, resolvedAt: now.toISOString() };
    await this.store.updateOrder(id, { dispute });
    const fresh = await this.found(id);
    if (input.outcome === "refund") return this.refund(id, { amountCents: input.amountCents, reason: input.note });
    if (input.outcome === "rework") return this.toDto(await this.move(fresh, "in_progress", {}), "admin");
    const done = await this.move(fresh, "completed", { completedAt: fresh.completedAt ?? now });
    return this.toDto(await this.payout(done), "admin");
  }

  async assign(id: string, expertId: string, now = new Date()): Promise<OrderDto> {
    const order = await this.found(id);
    if (!["paid", "in_progress"].includes(order.status)) throw new ValidationError("Only paid orders can be (re)assigned");
    const expert = await this.store.expert(expertId);
    if (!expert || expert.status !== "approved") throw new ValidationError("Choose an approved expert");
    const next = (await this.store.updateOrder(id, { expertId, assignedAt: now }))!;
    await this.notifyAssigned(next);
    return this.toDto(next, "admin");
  }

  /** Pays out a completed order that hasn't been paid (also used by admins to retry). */
  async releasePayout(id: string): Promise<OrderDto> {
    return this.toDto(await this.payout(await this.found(id)), "admin");
  }

  // ─── Helpers ─────────────────────────────────────────────

  /** What the expert's share is computed from: the price paid, or the list price for included reviews. */
  private listPrice(o: OrderRow): number {
    return o.included ? priceFor(o.kind as ServiceKind, { durationMin: o.durationMin ?? undefined }) : o.priceCents;
  }

  private async payout(order: OrderRow): Promise<OrderRow> {
    if (order.status !== "completed" || order.transferId || !order.expert) return order;
    const amount = splitPayment(this.listPrice(order)).expertCents;
    const transferId = await this.payments
      .transfer({ accountId: order.expert.payoutsEnabled ? order.expert.stripeAccountId : null, amountCents: amount, currency: order.currency, orderId: order.id })
      .catch((e: unknown) => {
        this.logger.error(`Payout for ${order.id} failed: ${e instanceof Error ? e.message : String(e)}`);
        return null;
      });
    if (!transferId) return order;
    return (await this.store.updateOrder(order.id, { transferId }))!;
  }

  private async move(order: OrderRow, to: OrderStatus, patch: OrderPatch): Promise<OrderRow> {
    allow(order.status, to);
    const next = await this.store.updateOrder(order.id, { ...patch, status: to }, [order.status]);
    if (!next) throw new ConflictError("The order changed in the meantime. Please reload.");
    return next;
  }

  private async found(id: string): Promise<OrderRow> {
    const order = await this.store.order(id);
    if (!order) throw new NotFoundError("Order", id);
    return order;
  }

  private async visible(user: AuthUser, id: string): Promise<{ order: OrderRow; viewer: Viewer }> {
    const order = await this.found(id);
    if (order.userId === user.id) return { order, viewer: "buyer" };
    if (order.expertId === user.id && order.status !== "pending_payment") return { order, viewer: "expert" };
    if (user.role === "admin") return { order, viewer: "admin" };
    throw new NotFoundError("Order", id);
  }

  private async asBuyer(user: AuthUser, id: string): Promise<OrderRow> {
    const order = await this.found(id);
    if (order.userId !== user.id) throw new NotFoundError("Order", id);
    return order;
  }

  private async asExpert(user: AuthUser, id: string): Promise<OrderRow> {
    const order = await this.found(id);
    if (order.expertId !== user.id || order.status === "pending_payment") {
      if (order.userId === user.id) throw new ForbiddenError("Only the expert can do that");
      throw new NotFoundError("Order", id);
    }
    return order;
  }

  private async email(jobId: string, to: string, name: string, notice: { subject: string; lines: string[]; action?: { label: string; url: string } }) {
    const payload: EmailJob = { template: "notice", to, name, subject: notice.subject.slice(0, 200), lines: notice.lines.map((l) => l.slice(0, 1000)).slice(0, 12), ...(notice.action ? { action: notice.action } : {}) };
    await this.jobs.enqueue(QUEUES.email, "send", payload, { jobId: `svc-${jobId}`.replace(/:/g, "-") });
  }

  private async notifyAdmins(jobId: string, subject: string, lines: string[]) {
    for (const to of this.config.ADMIN_EMAILS) await this.email(`${jobId}-${to}`, to, "Admin", { subject, lines });
  }

  toDto(o: OrderRow, viewer: Viewer): OrderDto {
    const info = SERVICES[o.kind as ServiceKind];
    const end = o.scheduledAt ? new Date(o.scheduledAt.getTime() + (o.durationMin ?? 60) * MIN) : null;
    return {
      id: o.id,
      kind: o.kind as ServiceKind,
      name: info.name,
      status: o.status as OrderStatus,
      viewerRole: viewer,
      buyer: { id: o.buyer.id, name: o.buyer.name },
      expert: o.expert ? { userId: o.expert.userId, displayName: o.expert.displayName, photoUrl: o.expert.photoUrl } : null,
      resumeId: o.resumeId,
      resumeTitle: o.resumeTitle,
      priceCents: o.priceCents,
      currency: o.currency,
      expertCents: viewer === "buyer" ? null : splitPayment(this.listPrice(o)).expertCents,
      included: o.included,
      intake: o.intake,
      dueAt: iso(o.dueAt),
      scheduledAt: iso(o.scheduledAt),
      durationMin: o.durationMin,
      meetingUrl: o.status === "pending_payment" ? null : o.meetingUrl,
      calendarUrl:
        o.scheduledAt && end && o.meetingUrl
          ? googleCalendarUrl({ start: o.scheduledAt, end, title: `Coaching session${o.expert ? ` with ${o.expert.displayName}` : ""}`, description: `Join: ${o.meetingUrl}`, location: o.meetingUrl })
          : null,
      deliveryNote: o.deliveryNote,
      revisionsIncluded: o.revisionsIncluded,
      revisionsUsed: o.revisionsUsed,
      rating: o.rating,
      ratingComment: o.ratingComment,
      refundReason: o.refundReason,
      dispute: o.dispute,
      paidOut: Boolean(o.transferId),
      paidAt: iso(o.paidAt),
      deliveredAt: iso(o.deliveredAt),
      completedAt: iso(o.completedAt),
      createdAt: o.createdAt.toISOString(),
    };
  }
}
