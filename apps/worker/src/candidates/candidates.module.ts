import { FILE_STORAGE, LocalDiskStorage } from "@cvb/storage";
import { Module } from "@nestjs/common";
import { WORKER_CONFIG, type WorkerConfig } from "../config/worker-config.js";
import { FileResumeParser, RESUME_PARSER } from "../resume-import/resume-parser.js";
import { CandidateImportProcessor } from "./candidate-import.processor.js";
import { CANDIDATE_RESULTS, PrismaCandidateResults } from "./candidate-results.js";

@Module({
  providers: [
    CandidateImportProcessor,
    { provide: RESUME_PARSER, useClass: FileResumeParser },
    { provide: CANDIDATE_RESULTS, useClass: PrismaCandidateResults },
    { provide: FILE_STORAGE, inject: [WORKER_CONFIG], useFactory: (c: WorkerConfig) => new LocalDiskStorage(c.STORAGE_DIR) },
  ],
})
export class CandidatesModule {}
