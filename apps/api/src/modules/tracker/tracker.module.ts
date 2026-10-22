import { Module } from "@nestjs/common";
import { JobsModule } from "../jobs/jobs.module.js";
import { ResumesModule } from "../resumes/resumes.module.js";
import { ShareLinksModule } from "../share-links/share-links.module.js";
import { APPLICATIONS_REPOSITORY } from "./applications.repository.js";
import { PrismaApplicationsRepository } from "./prisma-applications.repository.js";
import { TrackerController } from "./tracker.controller.js";
import { TrackerService } from "./tracker.service.js";

@Module({
  imports: [JobsModule, ResumesModule, ShareLinksModule],
  controllers: [TrackerController],
  providers: [TrackerService, { provide: APPLICATIONS_REPOSITORY, useClass: PrismaApplicationsRepository }],
  exports: [TrackerService],
})
export class TrackerModule {}
