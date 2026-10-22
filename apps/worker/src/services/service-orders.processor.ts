import { QUEUES, type EmailJob } from "@cvb/contracts";
import { AUTO_COMPLETE_DAYS, SERVICES, priceFor, splitPayment, type ServiceKind } from "@cvb/domain";
import { JOB_PRODUCER, type JobProducer } from "@cvb/queue";
import { InjectQueue, Processor } from "@nestjs/bullmq";
import { Inject, Logger, type OnModuleInit } from "@nestjs/common";
import type { Job, Queue } from "bullmq";
import { ConfiguredWorkerHost } from "../common/configured-worker-host.js";
import { PAYOUTS, type Payouts } from "./payouts.js";
import { SERVICE_ORDERS_STORE, type ServiceOrdersStore } from "./orders.store.js";

const HOUR = 3600_000;
const DUE_SOON_HOURS = 6;

/**
 * Keeps expert orders moving: warns experts (and admins when late) about deadlines, and
 * completes deliveries the buyer hasn't answered in a week, paying the expert.
 */
@Processor(QUEUES.services)
export class ServiceOrdersProcessor extends ConfiguredWorkerHost implements OnModuleInit {
  private readonly logger = new Logger(ServiceOrdersProcessor.name);

  constructor(
    @Inject(SERVICE_ORDERS_STORE) private readonly store: ServiceOrdersStore,
    @Inject(JOB_PRODUCER) private readonly jobs: JobProducer,
    @Inject(PAYOUTS) private readonly payouts: Payouts,
    @InjectQueue(QUEUES.services) private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler("order-deadlines", { every: HOUR / 2 }, { name: "deadlines", data: {} });
    await this.queue.upsertJobScheduler("order-autocomplete", { pattern: "41 * * * *" }, { name: "autocomplete", data: {} });
  }

  process(job: Job): Promise<unknown> {
    if (job.name === "deadlines") return this.deadlines(new Date());
    if (job.name === "autocomplete") return this.autocomplete(new Date());
    throw new Error(`Unknown services job ${job.name}`);
  }

  private admins(): string[] {
    return this.config.ADMIN_EMAILS;
  }

  async deadlines(now: Date): Promise<{ dueSoon: number; overdue: number }> {
    let dueSoon = 0;
    let overdue = 0;
    for (const o of await this.store.dueBefore(new Date(now.getTime() + DUE_SOON_HOURS * HOUR))) {
      const name = SERVICES[o.kind as ServiceKind]?.name ?? "Order";
      const url = `${this.config.APP_URL}/orders/${o.id}`;
      if (o.dueAt > now) {
        dueSoon++;
        if (o.expert) await this.send(`due-soon-${o.id}`, o.expert.email, o.expert.displayName, `Due soon: ${name}`, [`This order is due ${o.dueAt.toUTCString()}.`], url);
      } else {
        overdue++;
        const day = now.toISOString().slice(0, 10);
        if (o.expert) await this.send(`overdue-${o.id}-${day}`, o.expert.email, o.expert.displayName, `Overdue: ${name}`, [`This order was due ${o.dueAt.toUTCString()}. Please deliver or message the customer.`], url);
        for (const to of this.admins()) {
          await this.send(`overdue-admin-${o.id}-${day}-${to}`, to, "Admin", `Overdue order ${o.id}`, [`${name} for ${o.expert?.displayName ?? "no expert"} was due ${o.dueAt.toUTCString()}. Consider reassigning or refunding.`], `${this.config.APP_URL}/admin?tab=experts`);
        }
      }
    }
    if (dueSoon || overdue) this.logger.log(`Order deadlines: ${dueSoon} due soon, ${overdue} overdue`);
    return { dueSoon, overdue };
  }

  async autocomplete(now: Date): Promise<{ completed: number; paid: number }> {
    let completed = 0;
    let paid = 0;
    for (const o of await this.store.staleDeliveries(new Date(now.getTime() - AUTO_COMPLETE_DAYS * 24 * HOUR))) {
      if (!(await this.store.complete(o.id, now))) continue;
      completed++;
      const list = o.included ? priceFor(o.kind as ServiceKind, { durationMin: o.durationMin ?? undefined }) : o.priceCents;
      if (o.expert) {
        const transferId = await this.payouts({
          accountId: o.expert.payoutsEnabled ? o.expert.stripeAccountId : null,
          amountCents: splitPayment(list).expertCents,
          currency: o.currency,
          orderId: o.id,
        }).catch((e: unknown) => {
          this.logger.error(`Payout for ${o.id} failed: ${e instanceof Error ? e.message : String(e)}`);
          return null;
        });
        if (transferId) {
          await this.store.setTransfer(o.id, transferId);
          paid++;
        }
        await this.send(`autocompleted-expert-${o.id}`, o.expert.email, o.expert.displayName, "Order completed", ["The customer didn't respond within a week, so the order completed automatically."], `${this.config.APP_URL}/orders/${o.id}`);
      }
      await this.send(`autocompleted-${o.id}`, o.buyer.email, o.buyer.name, "Your order is complete", [`It's been ${AUTO_COMPLETE_DAYS} days since delivery, so we've marked it complete. You can still rate the expert.`], `${this.config.APP_URL}/orders/${o.id}`);
    }
    if (completed) this.logger.log(`Auto-completed ${completed} orders, paid ${paid}`);
    return { completed, paid };
  }

  private async send(jobId: string, to: string, name: string, subject: string, lines: string[], url: string) {
    const payload: EmailJob = { template: "notice", to, name, subject: subject.slice(0, 200), lines, action: { label: "Open the order", url } };
    await this.jobs.enqueue(QUEUES.email, "send", payload, { jobId: `svc-${jobId}`.replace(/:/g, "-") });
  }
}
