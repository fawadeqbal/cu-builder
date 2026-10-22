import { Module } from "@nestjs/common";
import { WORKER_CONFIG, type WorkerConfig } from "../config/worker-config.js";
import { PAYOUTS, stripePayouts } from "./payouts.js";
import { PrismaServiceOrdersStore, SERVICE_ORDERS_STORE } from "./orders.store.js";
import { ServiceOrdersProcessor } from "./service-orders.processor.js";

@Module({
  providers: [
    ServiceOrdersProcessor,
    { provide: SERVICE_ORDERS_STORE, useClass: PrismaServiceOrdersStore },
    { provide: PAYOUTS, inject: [WORKER_CONFIG], useFactory: (c: WorkerConfig) => stripePayouts(c.STRIPE_SECRET_KEY) },
  ],
})
export class ServiceOrdersModule {}
