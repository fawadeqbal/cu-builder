import { Module } from "@nestjs/common";
import { CandidatesController } from "./candidates.controller.js";
import { CandidatesService } from "./candidates.service.js";
import { CANDIDATES_STORE } from "./candidates.store.js";
import { PrismaCandidatesStore } from "./prisma-candidates.store.js";

@Module({
  controllers: [CandidatesController],
  providers: [CandidatesService, { provide: CANDIDATES_STORE, useClass: PrismaCandidatesStore }],
})
export class CandidatesModule {}
