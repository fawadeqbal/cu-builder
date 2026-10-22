import { Global, Module } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../../config/app-config.js";
import { BillingAdminController } from "./billing-admin.controller.js";
import { BillingController } from "./billing.controller.js";
import { BILLING_REPOSITORY } from "./billing.repository.js";
import { BillingService } from "./billing.service.js";
import { EntitlementsService } from "./entitlements.service.js";
import { PAYMENT_GATEWAYS } from "./payment-gateway.js";
import { PrismaBillingRepository } from "./prisma-billing.repository.js";
import { PRICE_SETTINGS } from "./price-settings.repository.js";
import { PrismaPriceSettings } from "./prisma-price-settings.repository.js";
import { StripeGateway } from "./stripe.gateway.js";
import { UnavailableGateway } from "./unavailable.gateway.js";

@Global()
@Module({
  controllers: [BillingController, BillingAdminController],
  providers: [
    BillingService,
    EntitlementsService,
    { provide: BILLING_REPOSITORY, useClass: PrismaBillingRepository },
    { provide: PRICE_SETTINGS, useClass: PrismaPriceSettings },
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
  exports: [EntitlementsService, BillingService],
})
export class BillingModule {}
