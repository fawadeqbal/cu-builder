import { QUEUES } from "@cvb/contracts";
import { parseJob } from "@cvb/queue";
import { Processor } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { ConfiguredWorkerHost } from "../common/configured-worker-host.js";
import { EMAIL_SENDER, type EmailSender } from "./email-sender.js";

/** Consumes the email queue. Payloads are validated against the same contract the api used. */
@Processor(QUEUES.email)
export class EmailProcessor extends ConfiguredWorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(@Inject(EMAIL_SENDER) private readonly sender: EmailSender) {
    super();
  }

  async process(job: Job): Promise<void> {
    const message = parseJob(QUEUES.email, "send", job.data);
    await this.sender.send(message);
    this.logger.log(`Sent ${message.template} email (job ${job.id})`);
  }
}
