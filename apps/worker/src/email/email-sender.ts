import type { EmailJob } from "@cvb/contracts";
import { Injectable, Logger } from "@nestjs/common";
import nodemailer, { type Transporter } from "nodemailer";
import { renderEmail } from "./templates.js";

/**
 * Port for sending email. EmailModule picks the adapter from config (Strategy): SMTP when
 * SMTP_URL is set, otherwise the console logger. Processors never change when the provider does.
 */
export interface EmailSender {
  send(message: EmailJob): Promise<void>;
}

export const EMAIL_SENDER = Symbol.for("cvb.worker.EmailSender");

/** Development adapter: logs the email instead of sending it. */
@Injectable()
export class ConsoleEmailSender implements EmailSender {
  private readonly logger = new Logger("Email");

  constructor(private readonly appUrl = "http://localhost:3000") {}

  async send(message: EmailJob): Promise<void> {
    const { subject, text } = renderEmail(message, this.appUrl);
    this.logger.log(`→ ${message.to} [${message.template}] "${subject}"\n${text}`);
  }
}

/** Sends through any SMTP server (your provider, Postmark, SES SMTP, Mailgun…). */
export class SmtpEmailSender implements EmailSender {
  private readonly transport: Transporter;

  constructor(
    smtpUrl: string,
    private readonly from: string,
    private readonly appUrl: string,
  ) {
    this.transport = nodemailer.createTransport(smtpUrl);
  }

  async send(message: EmailJob): Promise<void> {
    const { subject, text, html } = renderEmail(message, this.appUrl);
    const replyTo = "replyTo" in message ? message.replyTo : undefined;
    await this.transport.sendMail({ from: this.from, to: message.to, subject, text, html, ...(replyTo ? { replyTo } : {}) });
  }
}
