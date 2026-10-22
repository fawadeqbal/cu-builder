import { Global, Module } from "@nestjs/common";
import { PrismaTemplateCatalog } from "./prisma-template-catalog.js";
import { TEMPLATE_CATALOG } from "./template-catalog.js";
import { TemplatesController } from "./templates.controller.js";

@Global()
@Module({
  controllers: [TemplatesController],
  providers: [{ provide: TEMPLATE_CATALOG, useClass: PrismaTemplateCatalog }],
  exports: [TEMPLATE_CATALOG],
})
export class TemplatesModule {}
