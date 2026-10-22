import { Global, Module } from "@nestjs/common";
import { OrgsController } from "./orgs.controller.js";
import { OrgsService } from "./orgs.service.js";
import { ORGS_STORE } from "./orgs.store.js";
import { PrismaOrgsStore } from "./prisma-orgs.store.js";

/** Global so the auth hook (SSO join) and entitlements (seat plans) can reach it. */
@Global()
@Module({
  controllers: [OrgsController],
  providers: [OrgsService, { provide: ORGS_STORE, useClass: PrismaOrgsStore }],
  exports: [OrgsService, ORGS_STORE],
})
export class OrgsModule {}
