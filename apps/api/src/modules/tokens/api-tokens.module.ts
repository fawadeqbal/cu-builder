import { Global, Module } from "@nestjs/common";
import { ApiTokensController } from "./api-tokens.controller.js";
import { ApiTokensService } from "./api-tokens.service.js";

@Global()
@Module({ controllers: [ApiTokensController], providers: [ApiTokensService], exports: [ApiTokensService] })
export class ApiTokensModule {}
