import { Module } from "@nestjs/common";
import { ResumesModule } from "../resumes/resumes.module.js";
import { HttpJobPageReader, JOB_PAGE_READER } from "./job-page-reader.js";
import { JobsController } from "./jobs.controller.js";
import { JOBS_REPOSITORY } from "./jobs.repository.js";
import { JobsService } from "./jobs.service.js";
import { PrismaJobsRepository } from "./prisma-jobs.repository.js";

@Module({
  imports: [ResumesModule],
  controllers: [JobsController],
  providers: [
    JobsService,
    { provide: JOBS_REPOSITORY, useClass: PrismaJobsRepository },
    { provide: JOB_PAGE_READER, useClass: HttpJobPageReader },
  ],
  exports: [JobsService],
})
export class JobsModule {}
