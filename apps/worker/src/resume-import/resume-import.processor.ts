import { QUEUES } from "@cvb/contracts";
import { parseJob } from "@cvb/queue";
import { Processor } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { ConfiguredWorkerHost } from "../common/configured-worker-host.js";
import { RESUME_PARSER, type ResumeParser } from "./resume-parser.js";

@Processor(QUEUES.resumeImport)
export class ResumeImportProcessor extends ConfiguredWorkerHost {
  private readonly logger = new Logger(ResumeImportProcessor.name);

  constructor(@Inject(RESUME_PARSER) private readonly parser: ResumeParser) {
    super();
  }

  async process(job: Job): Promise<{ sections: number }> {
    const payload = parseJob(QUEUES.resumeImport, "parse", job.data);
    const cv = await this.parser.parse(payload);
    this.logger.log(`Parsed ${payload.fileName} for ${payload.userId}`);
    // Phase 1: save `cv` as a new resume for payload.userId through a ResumesWriter port.
    return { sections: cv.experience.length + cv.education.length };
  }
}
