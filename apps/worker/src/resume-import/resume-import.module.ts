import { Module } from "@nestjs/common";
import { ResumeImportProcessor } from "./resume-import.processor.js";
import { NotYetAvailableParser, RESUME_PARSER } from "./resume-parser.js";

@Module({
  providers: [ResumeImportProcessor, { provide: RESUME_PARSER, useClass: NotYetAvailableParser }],
})
export class ResumeImportModule {}
