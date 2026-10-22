import { DB } from "@cvb/db/nest";
import { Prisma, planToDb, planToDomain, type DbClient, type SubscriptionStatus } from "@cvb/db";
import type { SubscriptionState } from "@cvb/domain";
import { Inject, Injectable } from "@nestjs/common";
import type { BillingProfile, BillingRepository } from "./billing.repository.js";

const STATUS_TO_DB: Record<SubscriptionState["status"], SubscriptionStatus> = {
  trialing: "TRIALING",
  active: "ACTIVE",
  past_due: "PAST_DUE",
  canceled: "CANCELED",
  incomplete: "INCOMPLETE",
};
const STATUS_TO_DOMAIN = Object.fromEntries(Object.entries(STATUS_TO_DB).map(([k, v]) => [v, k])) as Record<
  SubscriptionStatus,
  SubscriptionState["status"]
>;

@Injectable()
export class PrismaBillingRepository implements BillingRepository {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async profile(userId: string): Promise<BillingProfile | null> {
    const u = await this.db.user.findUnique({
      where: { id: userId },
      include: { subscriptions: true, passes: true },
    });
    if (!u) return null;
    return {
      userId: u.id,
      email: u.email,
      name: u.name,
      basePlan: planToDomain(u.plan),
      stripeCustomerId: u.stripeCustomerId,
      subscriptions: u.subscriptions.map((s) => ({
        plan: planToDomain(s.plan),
        status: STATUS_TO_DOMAIN[s.status],
        currentPeriodEnd: s.currentPeriodEnd,
        providerRef: s.providerRef,
        cancelAtPeriodEnd: s.cancelAtPeriodEnd,
      })),
      passes: u.passes.map((p) => ({ plan: planToDomain(p.plan), startsAt: p.startsAt, endsAt: p.endsAt })),
    };
  }

  async setStripeCustomerId(userId: string, customerId: string): Promise<void> {
    await this.db.user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } });
  }

  async userIdForStripeCustomer(customerId: string): Promise<string | null> {
    const u = await this.db.user.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true } });
    return u?.id ?? null;
  }

  async upsertSubscription(input: Parameters<BillingRepository["upsertSubscription"]>[0]): Promise<void> {
    const data = {
      plan: planToDb(input.plan),
      status: STATUS_TO_DB[input.status],
      currentPeriodEnd: input.currentPeriodEnd,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      currency: input.currency,
    };
    await this.db.subscription.upsert({
      where: { providerRef: input.providerRef },
      update: data,
      create: { ...data, userId: input.userId, provider: "STRIPE", providerRef: input.providerRef },
    });
  }

  async addCredits({ userId, credits, providerRef }: { userId: string; credits: number; providerRef: string }): Promise<void> {
    await this.db.creditLedger.create({ data: { userId, delta: credits, reason: `purchase:${providerRef}` } });
  }

  async addPass(input: Parameters<BillingRepository["addPass"]>[0]): Promise<void> {
    await this.db.pass.upsert({
      where: { providerRef: input.providerRef },
      update: {},
      create: {
        userId: input.userId,
        plan: planToDb(input.plan),
        kind: input.offer === "pass_7d" ? "DAYS_7" : "DAYS_30",
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        provider: "STRIPE",
        providerRef: input.providerRef,
        amountCents: input.amountCents,
        currency: input.currency,
      },
    });
  }

  async markEventProcessed(id: string, type: string, payment?: { amountCents: number; currency: string }): Promise<boolean> {
    try {
      await this.db.billingEvent.create({ data: { id, type, provider: "STRIPE", ...(payment ?? {}) } });
      return true;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
      throw e;
    }
  }
}
