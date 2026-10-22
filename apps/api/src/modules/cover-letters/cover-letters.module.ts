import { Module } from "@nestjs/common";
import { JobsModule } from "../jobs/jobs.module.js";
import { ResumesModule } from "../resumes/resumes.module.js";
import { CoverLettersController } from "./cover-letters.controller.js";
import { COVER_LETTERS_REPOSITORY } from "./cover-letters.repository.js";
import { CoverLettersService } from "./cover-letters.service.js";
import { PrismaCoverLettersRepository } from "./prisma-cover-letters.repository.js";

@Module({
  imports: [ResumesModule, JobsModule],
  controllers: [CoverLettersController],
  providers: [CoverLettersService, { provide: COVER_LETTERS_REPOSITORY, useClass: PrismaCoverLettersRepository }],
})
export class CoverLettersModule {}
