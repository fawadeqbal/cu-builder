import { ASSISTANT } from "@cvb/ai";
import { createAssistant } from "@cvb/ai/factory";
import { FILE_STORAGE, LocalDiskStorage } from "@cvb/storage";
import { Logger, Module } from "@nestjs/common";
import { WORKER_CONFIG, type WorkerConfig } from "../config/worker-config.js";
import { IMPORT_RESULTS, PrismaImportResults } from "./import-results.js";
import { ResumeImportProcessor } from "./resume-import.processor.js";
import { FileResumeParser, RESUME_PARSER } from "./resume-parser.js";

@Module({
  providers: [
    ResumeImportProcessor,
    { provide: RESUME_PARSER, useClass: FileResumeParser },
    { provide: IMPORT_RESULTS, useClass: PrismaImportResults },
    { provide: FILE_STORAGE, inject: [WORKER_CONFIG], useFactory: (c: WorkerConfig) => new LocalDiskStorage(c.STORAGE_DIR) },
    {
      // Reading imported CVs with AI (Ollama or Claude, as configured); offline = rule-based only.
      provide: ASSISTANT,
      inject: [WORKER_CONFIG],
      useFactory: (c: WorkerConfig) => {
        const log = new Logger("ResumeImportAI");
        return createAssistant(c, { log: (m) => log.log(m), warn: (m) => log.warn(m) });
      },
    },
  ],
})
export class ResumeImportModule {}
