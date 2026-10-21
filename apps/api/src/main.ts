import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { APP_CONFIG, type AppConfig } from "./config/app-config.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get<AppConfig>(APP_CONFIG);

  app.setGlobalPrefix("api/v1");
  app.enableCors({ origin: config.API_CORS_ORIGINS, credentials: true });
  app.enableShutdownHooks();

  await app.listen(config.API_PORT);
  Logger.log(`API listening on http://localhost:${config.API_PORT}/api/v1`, "Bootstrap");
}

void bootstrap();
