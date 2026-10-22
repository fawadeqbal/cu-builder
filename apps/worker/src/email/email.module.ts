import { Module } from "@nestjs/common";
import { WORKER_CONFIG, type WorkerConfig } from "../config/worker-config.js";
import { ConsoleEmailSender, EMAIL_SENDER, SmtpEmailSender } from "./email-sender.js";
import { EmailProcessor } from "./email.processor.js";

@Module({
  providers: [
    EmailProcessor,
    {
      provide: EMAIL_SENDER,
      inject: [WORKER_CONFIG],
      useFactory: (config: WorkerConfig) =>
        config.SMTP_URL
          ? new SmtpEmailSender(config.SMTP_URL, config.EMAIL_FROM, config.APP_URL)
          : new ConsoleEmailSender(config.APP_URL),
    },
  ],
})
export class EmailModule {}
