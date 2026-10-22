import { Logger, Module, type OnModuleInit } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../../config/app-config.js";
import { BillingService } from "../billing/billing.service.js";
import { ExpertsService } from "./experts.service.js";
import { ORDERS_STORE, PrismaOrdersStore } from "./orders.store.js";
import { OrdersService } from "./orders.service.js";
import { ExpertsController, OrdersController, ServicesAdminController } from "./services.controller.js";
import { DevServicePayments, OffServicePayments, SERVICE_PAYMENTS, StripeServicePayments, type ServicePayments } from "./service-payments.js";

/** Expert services marketplace: catalogue, experts, orders, payouts. */
@Module({
  controllers: [ExpertsController, OrdersController, ServicesAdminController],
  providers: [
    OrdersService,
    ExpertsService,
    { provide: ORDERS_STORE, useClass: PrismaOrdersStore },
    {
      provide: SERVICE_PAYMENTS,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): ServicePayments => {
        if (config.STRIPE_SECRET_KEY) return new StripeServicePayments(config.STRIPE_SECRET_KEY);
        if (config.DEV_AUTH && config.NODE_ENV !== "production") {
          new Logger("ServicesModule").warn("Stripe isn't configured: expert orders are marked paid at once (development only)");
          return new DevServicePayments();
        }
        return new OffServicePayments();
      },
    },
  ],
  exports: [OrdersService],
})
export class ServicesModule implements OnModuleInit {
  constructor(
    private readonly billing: BillingService,
    private readonly orders: OrdersService,
  ) {}

  /** Stripe webhooks arrive at billing; paid orders are handed over here. */
  onModuleInit(): void {
    this.billing.onOrderPaid(async (orderId, paymentRef) => {
      await this.orders.markPaid(orderId, paymentRef);
    });
  }
}
