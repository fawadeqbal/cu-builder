import { Module } from "@nestjs/common";
import { ConsoleEmailSender, EMAIL_SENDER } from "./email-sender.js";
import { EmailProcessor } from "./email.processor.js";

@Module({
  providers: [EmailProcessor, { provide: EMAIL_SENDER, useClass: ConsoleEmailSender }],
})
export class EmailModule {}
