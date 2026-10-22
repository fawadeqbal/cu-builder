import { QUEUES } from "@cvb/contracts";
import { parseJob } from "@cvb/queue";
import { Processor } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import { UnrecoverableError, type Job } from "bullmq";
import { ConfiguredWorkerHost } from "../common/configured-worker-host.js";
import { IMPORT_RESULTS, type ImportResults } from "./import-results.js";
import { RESUME_PARSER, type ResumeParser } from "./resume-parser.js";

/** Turns an uploaded CV into a new resume. Permanent problems fail at once; others retry. */
// A local model can take a minute or two on a long CV: hold the job's lock long enough.
@Processor(QUEUES.resumeImport, { lockDuration: 5 * 60_000 })
export class ResumeImportProcessor extends ConfiguredWorkerHost {
  private readonly logger = new Logger(ResumeImportProcessor.name);

  constructor(
    @Inject(RESUME_PARSER) private readonly parser: ResumeParser,
    @Inject(IMPORT_RESULTS) private readonly results: ImportResults,
  ) {
    super();
  }

  async process(job: Job): Promise<{ resumeId: string }> {
    const payload = parseJob(QUEUES.resumeImport, "parse", job.data);
    await this.results.markProcessing(payload.importId);
    try {
      const { cv, warnings } = await this.parser.parse(payload);
      const title = cv.personal.name ? `${cv.personal.name} (imported)` : payload.fileName.replace(/\.[a-z]+$/i, "");
      const resumeId = await this.results.complete({ importId: payload.importId, userId: payload.userId, title, cv, warnings });
      this.logger.log(`Imported ${payload.fileName} → resume ${resumeId} (${warnings.length} warnings)`);
      return { resumeId };
    } catch (e) {
      const finalAttempt = e instanceof UnrecoverableError || job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      if (finalAttempt) {
        await this.results.fail(payload.importId, e instanceof UnrecoverableError ? e.message : "The import failed. Please try again.");
      }
      throw e;
    }
  }
}
