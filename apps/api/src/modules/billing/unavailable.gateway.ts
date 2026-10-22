import { ValidationError } from "@cvb/shared";
import type { BillingEvent, PaymentGateway } from "./payment-gateway.js";

/**
 * Stands in for a gateway that is not configured (Stripe without keys) or not built yet
 * (local wallets). Offers show as unavailable; calls fail with a clear message.
 */
export class UnavailableGateway implements PaymentGateway {
  readonly available = false;

  constructor(
    readonly id: "stripe" | "local",
    private readonly reason: string,
  ) {}

  async createCheckout(): Promise<never> {
    throw new ValidationError(this.reason);
  }

  async createPortal(): Promise<never> {
    throw new ValidationError(this.reason);
  }

  async parseWebhook(): Promise<BillingEvent> {
    throw new ValidationError(this.reason);
  }
}
