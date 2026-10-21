import type { EmailJob } from "@cvb/contracts";
import { Injectable, Logger } from "@nestjs/common";

/**
 * Port for sending email. Adapters (console today; Resend, SES or SMTP later) are chosen in
 * EmailModule, so processors never change when the provider does.
 */
export interface EmailSender {
  send(message: EmailJob): Promise<void>;
}

export const EMAIL_SENDER = Symbol.for("cvb.worker.EmailSender");

/** Development adapter: logs the email instead of sending it. */
@Injectable()
export class ConsoleEmailSender implements EmailSender {
  private readonly logger = new Logger("Email");

  async send(message: EmailJob): Promise<void> {
    this.logger.log(`→ ${message.to} [${message.template}] ${JSON.stringify(message)}`);
  }
}
