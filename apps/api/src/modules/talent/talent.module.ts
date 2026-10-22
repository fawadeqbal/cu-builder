import { Module } from "@nestjs/common";
import { PrismaTalentStore } from "./prisma-talent.store.js";
import { TalentController } from "./talent.controller.js";
import { TalentService } from "./talent.service.js";
import { TALENT_STORE } from "./talent.store.js";

/** Opt-in talent search: job seekers' profiles, agency recruiters' search and messages. */
@Module({
  controllers: [TalentController],
  providers: [TalentService, { provide: TALENT_STORE, useClass: PrismaTalentStore }],
})
export class TalentModule {}
