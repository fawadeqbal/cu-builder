import type { BillingStatusDto, OfferDto, PriceSettingDto } from "@cvb/contracts";
import { QUEUES } from "@cvb/contracts";
import {
  DEFAULT_CURRENCY,
  checkPrice,
  effectivePlan,
  mrrMovements,
  offerById,
  offersIn,
  priceTable,
  resolvePrice,
  type Currency,
  type OfferId,
} from "@cvb/domain";
import { JOB_PRODUCER, type JobProducer } from "@cvb/queue";
import { NotFoundError, ValidationError } from "@cvb/shared";
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../../config/app-config.js";
import type { AuthUser } from "../../common/auth/auth.types.js";
import { ANALYTICS_RECORDER, type AnalyticsRecorder } from "../analytics/analytics-recorder.js";
import { BILLING_REPOSITORY, type BillingRepository, type EventPayment } from "./billing.repository.js";
import { PAYMENT_GATEWAYS, type BillingEvent, type PaymentGateway } from "./payment-gateway.js";
import { PRICE_SETTINGS, type PriceSettingsRepository } from "./price-settings.repository.js";

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
    @Inject(PRICE_SETTINGS) private readonly prices: PriceSettingsRepository,
    @Optional() @Inject(ANALYTICS_RECORDER) private readonly analytics?: AnalyticsRecorder,
  ) {}

  /** Expert services register here to hear about paid orders (keeps billing free of service code). */
  onOrderPaid(handler: (orderId: string, paymentRef: string) => Promise<void>): void {
    this.orderPaid = handler;
  }

  /** Every offer priced in `currency` (defaults, or the admin's overrides). */
  async offers(currency: Currency = DEFAULT_CURRENCY): Promise<OfferDto[]> {
    const overrides = await this.prices.list();
    return offersIn(currency, overrides).map((o) => ({
      id: o.id,
      kind: o.kind,
      plan: o.kind === "credits" ? undefined : o.plan,
      credits: o.kind === "credits" ? o.credits : undefined,
      interval: o.kind === "subscription" ? o.interval : undefined,
      days: o.kind === "pass" ? o.days : undefined,
      priceCents: o.priceCents,
      currency,
      available: this.gateways.stripe.available,
    }));
  }

  // ─── Admin: prices ────────────────────────────────────────────────────────

  /** Every offer in every currency, with what's overridden. */
  async priceSettings(): Promise<PriceSettingDto[]> {
    const rows = await this.prices.list();
    return priceTable(rows).map((p) => {
      const row = p.overridden ? rows.find((r) => r.offer === p.offer && r.currency === p.currency) : undefined;
      return { ...p, updatedAt: row?.updatedAt.toISOString() ?? null, updatedBy: row?.updatedBy ?? null };
    });
  }

  /** Sets one price. New checkouts use it at once; running subscriptions keep what they pay. */
  async setPrice(actor: AuthUser, offer: OfferId, currency: Currency, amount: number): Promise<PriceSettingDto> {
    const problem = checkPrice(currency, amount);
    if (problem) throw new ValidationError(problem);
    offerById(offer);
    await this.prices.upsert({ offer, currency, amount, updatedBy: actor.id });
    this.logger.log(`Price of ${offer} in ${currency} set to ${amount} by ${actor.id}`);
    return this.priceSetting(offer, currency);
  }

  /** Removes the override, back to the default price. */
  async resetPrice(actor: AuthUser, offer: OfferId, currency: Currency): Promise<PriceSettingDto> {
    if (await this.prices.remove(offer, currency)) this.logger.log(`Price of ${offer} in ${currency} reset by ${actor.id}`);
    return this.priceSetting(offer, currency);
  }

  private async priceSetting(offer: OfferId, currency: Currency): Promise<PriceSettingDto> {
    const all = await this.priceSettings();
    return all.find((p) => p.offer === offer && p.currency === currency)!;
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

  async checkout(
    user: AuthUser,
    offerId: OfferId,
    provider: "stripe" | "local",
    currency: Currency = DEFAULT_CURRENCY,
  ): Promise<{ url: string }> {
    const profile = await this.billing.profile(user.id);
    if (!profile) throw new NotFoundError("User", user.id);
    const { amount } = resolvePrice(offerId, currency, await this.prices.list());
    const offer = { ...offerById(offerId), priceCents: amount };
    const gateway = this.gateways[provider];
    const { url, customerRef } = await gateway.createCheckout({
      offer,
      price: { amount, currency },
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
    if (!(await this.billing.markEventProcessed(event.id, event.kind, await this.paymentOf(event)))) {
      this.logger.log(`Skipping already processed event ${event.id}`);
      return;
    }
    await this.apply(event);
  }

  /** What an event charged, refunded or failed to charge, and who for (the revenue report reads these rows). */
  private async paymentOf(event: Exclude<BillingEvent, { kind: "ignored" }>): Promise<EventPayment | undefined> {
    switch (event.kind) {
      case "payment.completed":
        return { amountCents: event.amountCents, currency: event.currency.toLowerCase(), userId: event.userId || null, offer: event.offer };
      case "invoice.paid":
      case "invoice.payment_failed":
      case "charge.refunded":
        return {
          amountCents: event.amountCents,
          currency: event.currency.toLowerCase(),
          userId: await this.userOf(event),
          offer: event.kind === "invoice.paid" ? event.offer : null,
        };
      case "order.paid":
        return event.currency ? { amountCents: event.amountCents, currency: event.currency.toLowerCase() } : undefined;
      default:
        return undefined;
    }
  }

  private async userOf(event: { userId: string | null; customerRef: string | null }): Promise<string | null> {
    return event.userId ?? (event.customerRef ? await this.billing.userIdForStripeCustomer(event.customerRef) : null);
  }

  /** Applies one normalised event. Public for tests. */
  async apply(event: Exclude<BillingEvent, { kind: "ignored" }>): Promise<void> {
    if (event.kind === "subscription.changed") {
      const userId = event.userId ?? (await this.billing.userIdForStripeCustomer(event.customerRef));
      if (!userId) throw new NotFoundError("Customer", event.customerRef);
      const before = await this.billing.findSubscription(event.subscriptionRef);
      const offer = event.offer ? offerById(event.offer) : null;
      const interval = event.interval ?? (offer?.kind === "subscription" ? offer.interval : null) ?? before?.interval ?? null;
      const amountCents = event.amountCents ?? before?.amountCents ?? null;
      const plan = event.plan === "free" ? "standard" : event.plan;
      const after = { status: event.status, amountCents, interval, plan, currency: event.currency };
      const now = new Date();
      const movements = mrrMovements(before, after).map((m) => ({ ...m, at: now }));
      await this.billing.upsertSubscription(
        {
          userId,
          providerRef: event.subscriptionRef,
          plan: event.plan,
          status: event.status,
          currentPeriodEnd: event.currentPeriodEnd,
          cancelAtPeriodEnd: event.cancelAtPeriodEnd,
          currency: event.currency,
          offerId: event.offer ?? undefined,
          amountCents: event.amountCents ?? undefined,
          interval: interval ?? undefined,
          canceledAt: event.status === "canceled" ? (before?.canceledAt ?? now) : null,
        },
        movements,
      );
      for (const m of movements) {
        const props = { plan, interval: interval ?? "month", mrr_change: m.deltaCents };
        if (m.kind === "new" || m.kind === "reactivation")
          await this.analytics?.record("subscription_started", { userId, currency: m.currency, props: { ...props, reactivated: m.kind === "reactivation" } });
        if (m.kind === "churn") await this.analytics?.record("subscription_cancelled", { userId, currency: m.currency, props });
      }
      return;
    }

    if (event.kind === "invoice.paid") {
      if (event.reason === "renewal") {
        await this.analytics?.record("subscription_renewed", {
          userId: await this.userOf(event),
          currency: event.currency.toLowerCase(),
          props: { amount: event.amountCents, ...(event.offer ? { offer: event.offer } : {}) },
        });
      }
      return;
    }

    if (event.kind === "invoice.payment_failed") {
      await this.analytics?.record("payment_failed", { userId: await this.userOf(event), currency: event.currency.toLowerCase(), props: { amount: event.amountCents } });
      return;
    }

    if (event.kind === "charge.refunded") {
      await this.analytics?.record("payment_refunded", { userId: await this.userOf(event), currency: event.currency.toLowerCase(), props: { amount: event.amountCents } });
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
        amountCents: event.amountCents,
        currency: event.currency.toLowerCase(),
      });
      description = `${offer.plan[0]!.toUpperCase()}${offer.plan.slice(1)} pass, ${offer.days} days`;
    } else if (offer.kind === "credits") {
      await this.billing.addCredits({ userId: event.userId, credits: offer.credits, providerRef: event.paymentRef });
      description = `${offer.credits} AI credits`;
    } else {
      throw new ValidationError(`Offer ${offer.id} is a subscription, not a one-off payment`);
    }
    await this.analytics?.record("purchase_completed", {
      userId: event.userId,
      currency: event.currency.toLowerCase(),
      props: { offer: offer.id, kind: offer.kind, amount: event.amountCents },
    });
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
