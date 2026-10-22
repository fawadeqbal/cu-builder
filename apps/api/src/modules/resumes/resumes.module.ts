import { Module } from "@nestjs/common";
import { PrismaResumesRepository } from "./prisma-resumes.repository.js";
import { ResumesController } from "./resumes.controller.js";
import { RESUMES_REPOSITORY } from "./resumes.repository.js";
import { ResumesService } from "./resumes.service.js";

@Module({
  controllers: [ResumesController],
  providers: [ResumesService, { provide: RESUMES_REPOSITORY, useClass: PrismaResumesRepository }],
  exports: [ResumesService],
})
export class ResumesModule {}
