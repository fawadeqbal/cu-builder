import { Global, Module } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../../config/app-config.js";
import { BillingController } from "./billing.controller.js";
import { BILLING_REPOSITORY } from "./billing.repository.js";
import { BillingService } from "./billing.service.js";
import { EntitlementsService } from "./entitlements.service.js";
import { PAYMENT_GATEWAYS } from "./payment-gateway.js";
import { PrismaBillingRepository } from "./prisma-billing.repository.js";
import { StripeGateway } from "./stripe.gateway.js";
import { UnavailableGateway } from "./unavailable.gateway.js";

@Global()
@Module({
  controllers: [BillingController],
  providers: [
    BillingService,
    EntitlementsService,
    { provide: BILLING_REPOSITORY, useClass: PrismaBillingRepository },
    {
      provide: PAYMENT_GATEWAYS,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        stripe: config.STRIPE_SECRET_KEY
          ? new StripeGateway(config.STRIPE_SECRET_KEY, config.STRIPE_WEBHOOK_SECRET)
          : new UnavailableGateway("stripe", "Card payments are not configured yet"),
        local: new UnavailableGateway("local", "JazzCash and Easypaisa are coming soon"),
      }),
    },
  ],
  exports: [EntitlementsService],
})
export class BillingModule {}
