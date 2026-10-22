import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { toNodeHandler } from "better-auth/node";
import express from "express";
import { AppModule } from "./app.module.js";
import { APP_CONFIG, type AppConfig } from "./config/app-config.js";
import { AUTH, type BetterAuth } from "./modules/auth/better-auth.js";

async function bootstrap(): Promise<void> {
  // Body parsing is set up by hand: Better Auth reads its own body, webhooks need raw bytes.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const config = app.get<AppConfig>(APP_CONFIG);
  const auth = app.get<BetterAuth>(AUTH);

  app.set("trust proxy", 1); // behind Caddy on the VPS
  app.enableCors({ origin: [config.APP_URL, ...config.API_CORS_ORIGINS], credentials: true });
  app.use("/api/auth", toNodeHandler(auth));
  app.use("/api/v1/billing/webhooks", express.raw({ type: "*/*", limit: "1mb" }));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "100kb" }));

  app.setGlobalPrefix("api/v1");
  app.enableShutdownHooks();

  await app.listen(config.API_PORT);
  Logger.log(`API listening on http://localhost:${config.API_PORT}/api/v1 (auth at /api/auth)`, "Bootstrap");
}

void bootstrap();
