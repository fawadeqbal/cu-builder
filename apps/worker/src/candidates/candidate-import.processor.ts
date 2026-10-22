import { QUEUES } from "@cvb/contracts";
import { lowConfidenceFields } from "@cvb/domain";
import { parseJob } from "@cvb/queue";
import { FILE_STORAGE, type FileStorage } from "@cvb/storage";
import { Processor } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import { UnrecoverableError, type Job } from "bullmq";
import { ConfiguredWorkerHost } from "../common/configured-worker-host.js";
import { RESUME_PARSER, type ResumeParser } from "../resume-import/resume-parser.js";
import { CANDIDATE_RESULTS, type CandidateResults } from "./candidate-results.js";

/**
 * Parses one file of an agency's bulk upload into a candidate CV and lists the fields to check.
 * The uploaded file is deleted once it has been read (or has finally failed): agencies keep the
 * structured CV, not the original.
 */
@Processor(QUEUES.candidateImport)
export class CandidateImportProcessor extends ConfiguredWorkerHost {
  private readonly logger = new Logger(CandidateImportProcessor.name);

  constructor(
    @Inject(RESUME_PARSER) private readonly parser: ResumeParser,
    @Inject(CANDIDATE_RESULTS) private readonly results: CandidateResults,
    @Inject(FILE_STORAGE) private readonly files: FileStorage,
  ) {
    super();
  }

  async process(job: Job): Promise<{ ready: boolean }> {
    const p = parseJob(QUEUES.candidateImport, "parse", job.data);
    if (!(await this.results.markParsing(p.candidateId))) {
      await this.files.delete(p.fileKey).catch(() => undefined);
      return { ready: false };
    }
    try {
      const { cv } = await this.parser.parse({ importId: p.candidateId, userId: "", fileKey: p.fileKey, fileName: p.fileName, mimeType: p.mimeType });
      const name = cv.personal.name || p.fileName.replace(/\.[a-z]+$/i, "");
      await this.results.complete(p.candidateId, { name, cv, lowConfidence: lowConfidenceFields(cv) });
      await this.files.delete(p.fileKey).catch(() => undefined);
      this.logger.log(`Candidate ${p.candidateId} parsed from ${p.fileName}`);
      return { ready: true };
    } catch (e) {
      const finalAttempt = e instanceof UnrecoverableError || job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      if (finalAttempt) {
        await this.results.fail(p.candidateId, e instanceof UnrecoverableError ? e.message : "This file couldn't be read. Try again or add the CV by hand.");
        await this.files.delete(p.fileKey).catch(() => undefined);
      }
      throw e;
    }
  }
}
