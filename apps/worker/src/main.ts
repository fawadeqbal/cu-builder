import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { WorkerModule } from "./worker.module.js";

/** No HTTP server: an application context that runs the BullMQ processors. */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  Logger.log("Worker started; waiting for jobs", "Bootstrap");
}

void bootstrap();
