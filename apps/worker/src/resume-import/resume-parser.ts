import type { CV } from "@cvb/domain";
import type { ResumeImportJob } from "@cvb/contracts";
import { Injectable } from "@nestjs/common";
import { UnrecoverableError } from "bullmq";

/** Port: turns an uploaded file into a CV document. Implemented in Phase 1 (PDF/DOCX parsing). */
export interface ResumeParser {
  parse(job: ResumeImportJob): Promise<CV>;
}

export const RESUME_PARSER = Symbol.for("cvb.worker.ResumeParser");

/** Placeholder until the parser ships. Fails without retries so the queue stays clean. */
@Injectable()
export class NotYetAvailableParser implements ResumeParser {
  async parse(job: ResumeImportJob): Promise<CV> {
    throw new UnrecoverableError(`CV import is not available yet (${job.fileName})`);
  }
}
