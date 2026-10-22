import type { BillingStatusDto, OfferDto } from "@cvb/contracts";
import { QUEUES } from "@cvb/contracts";
import { CURRENCY, OFFERS, effectivePlan, offerById, type OfferId } from "@cvb/domain";
import { JOB_PRODUCER, type JobProducer } from "@cvb/queue";
import { NotFoundError, ValidationError } from "@cvb/shared";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../../config/app-config.js";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { BILLING_REPOSITORY, type BillingRepository } from "./billing.repository.js";
import { PAYMENT_GATEWAYS, type BillingEvent, type PaymentGateway } from "./payment-gateway.js";

const DAY = 24 * 3600 * 1000;

/** Checkout, portal, status and webhook application. Provider details stay in the gateways. */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private orderPaid: ((orderId: string, paymentRef: string) => Promise<void>) | null = null;

  constructor(
    @Inject(BILLING_REPOSITORY) private readonly billing: BillingRepository,
    @Inject(PAYMENT_GATEWAYS) private readonly gateways: Record<"stripe" | "local", PaymentGateway>,
    @Inject(JOB_PRODUCER) private readonly jobs: JobProducer,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Expert services register here to hear about paid orders (keeps billing free of service code). */
  onOrderPaid(handler: (orderId: string, paymentRef: string) => Promise<void>): void {
    this.orderPaid = handler;
  }

  offers(): OfferDto[] {
    return OFFERS.map((o) => ({
      id: o.id,
      kind: o.kind,
      plan: o.kind === "credits" ? undefined : o.plan,
      credits: o.kind === "credits" ? o.credits : undefined,
      interval: o.kind === "subscription" ? o.interval : undefined,
      days: o.kind === "pass" ? o.days : undefined,
      priceCents: o.priceCents,
      currency: CURRENCY,
      available: this.gateways.stripe.available,
    }));
  }

  async status(user: AuthUser): Promise<BillingStatusDto> {
    const profile = await this.billing.profile(user.id);
    if (!profile) throw new NotFoundError("User", user.id);
    const now = new Date();
    const own = effectivePlan({ base: profile.basePlan, subscriptions: profile.subscriptions, passes: profile.passes }, now);
    // An organisation seat (resolved by the auth guard) can lift the plan above what was bought.
    const { plan, source } = user.planSource === "organization" ? { plan: user.plan, source: user.planSource } : own;
    const sub = profile.subscriptions
      .filter((s) => s.status !== "canceled" && s.currentPeriodEnd > now)
      .sort((a, b) => +b.currentPeriodEnd - +a.currentPeriodEnd)[0];
    const pass = profile.passes.filter((p) => p.startsAt <= now && p.endsAt > now).sort((a, b) => +b.endsAt - +a.endsAt)[0];
    return {
      plan,
      source,
      subscription: sub
        ? { plan: sub.plan, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd.toISOString(), cancelAtPeriodEnd: sub.cancelAtPeriodEnd }
        : null,
      pass: pass ? { plan: pass.plan, endsAt: pass.endsAt.toISOString() } : null,
      canManage: Boolean(profile.stripeCustomerId) && this.gateways.stripe.available,
    };
  }

  async checkout(user: AuthUser, offerId: OfferId, provider: "stripe" | "local"): Promise<{ url: string }> {
    const profile = await this.billing.profile(user.id);
    if (!profile) throw new NotFoundError("User", user.id);
    const offer = offerById(offerId);
    const gateway = this.gateways[provider];
    const { url, customerRef } = await gateway.createCheckout({
      offer,
      customer: { userId: user.id, email: profile.email, name: profile.name, stripeCustomerId: profile.stripeCustomerId },
      successUrl: `${this.config.APP_URL}/account/billing?checkout=success`,
      cancelUrl: `${this.config.APP_URL}/pricing?checkout=cancelled`,
    });
    if (provider === "stripe" && customerRef && customerRef !== profile.stripeCustomerId) {
      await this.billing.setStripeCustomerId(user.id, customerRef);
    }
    return { url };
  }

  async portal(user: AuthUser): Promise<{ url: string }> {
    const profile = await this.billing.profile(user.id);
    if (!profile?.stripeCustomerId) throw new ValidationError("There is no subscription to manage yet");
    return this.gateways.stripe.createPortal(profile.stripeCustomerId, `${this.config.APP_URL}/account/billing`);
  }

  async handleWebhook(provider: "stripe" | "local", rawBody: Buffer, signature: string | undefined): Promise<void> {
    const event = await this.gateways[provider].parseWebhook(rawBody, signature);
    if (event.kind === "ignored") return;
    if (!(await this.billing.markEventProcessed(event.id, event.kind))) {
      this.logger.log(`Skipping already processed event ${event.id}`);
      return;
    }
    await this.apply(event);
  }

  /** Applies one normalised event. Public for tests. */
  async apply(event: Exclude<BillingEvent, { kind: "ignored" }>): Promise<void> {
    if (event.kind === "subscription.changed") {
      const userId = event.userId ?? (await this.billing.userIdForStripeCustomer(event.customerRef));
      if (!userId) throw new NotFoundError("Customer", event.customerRef);
      await this.billing.upsertSubscription({
        userId,
        providerRef: event.subscriptionRef,
        plan: event.plan,
        status: event.status,
        currentPeriodEnd: event.currentPeriodEnd,
        cancelAtPeriodEnd: event.cancelAtPeriodEnd,
      });
      return;
    }

    if (event.kind === "order.paid") {
      if (!this.orderPaid) throw new Error("No handler for paid orders");
      await this.orderPaid(event.orderId, event.paymentRef);
      return;
    }

    const offer = offerById(event.offer);
    let description: string;
    if (offer.kind === "pass") {
      const startsAt = new Date();
      await this.billing.addPass({
        userId: event.userId,
        plan: offer.plan,
        startsAt,
        endsAt: new Date(startsAt.getTime() + offer.days * DAY),
        providerRef: event.paymentRef,
        offer: offer.id,
      });
      description = `${offer.plan[0]!.toUpperCase()}${offer.plan.slice(1)} pass, ${offer.days} days`;
    } else if (offer.kind === "credits") {
      await this.billing.addCredits({ userId: event.userId, credits: offer.credits, providerRef: event.paymentRef });
      description = `${offer.credits} AI credits`;
    } else {
      throw new ValidationError(`Offer ${offer.id} is a subscription, not a one-off payment`);
    }
    const profile = await this.billing.profile(event.userId);
    if (profile) {
      await this.jobs.enqueue(QUEUES.email, "send", {
        template: "receipt",
        to: profile.email,
        name: profile.name,
        description,
        amountCents: event.amountCents,
        currency: event.currency.toUpperCase().slice(0, 3),
      });
    }
  }
}
