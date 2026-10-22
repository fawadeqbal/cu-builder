import { Module } from "@nestjs/common";
import { ResumesModule } from "../resumes/resumes.module.js";
import { PrismaShareLinksRepository } from "./prisma-share-links.repository.js";
import { ShareLinksController } from "./share-links.controller.js";
import { SHARE_LINKS_REPOSITORY } from "./share-links.repository.js";
import { ShareLinksService } from "./share-links.service.js";

@Module({
  imports: [ResumesModule],
  controllers: [ShareLinksController],
  providers: [ShareLinksService, { provide: SHARE_LINKS_REPOSITORY, useClass: PrismaShareLinksRepository }],
  exports: [ShareLinksService],
})
export class ShareLinksModule {}
