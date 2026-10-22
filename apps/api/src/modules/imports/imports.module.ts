import { Module } from "@nestjs/common";
import { ResumesModule } from "../resumes/resumes.module.js";
import { ImportsController } from "./imports.controller.js";
import { IMPORTS_REPOSITORY } from "./imports.repository.js";
import { ImportsService } from "./imports.service.js";
import { PrismaImportsRepository } from "./prisma-imports.repository.js";

@Module({
  imports: [ResumesModule],
  controllers: [ImportsController],
  providers: [ImportsService, { provide: IMPORTS_REPOSITORY, useClass: PrismaImportsRepository }],
})
export class ImportsModule {}
