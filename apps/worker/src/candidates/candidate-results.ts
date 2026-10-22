import { DB } from "@cvb/db/nest";
import type { DbClient } from "@cvb/db";
import type { CV, LowConfidence } from "@cvb/domain";
import { Inject, Injectable } from "@nestjs/common";

/** Port: where the parsed candidate goes. */
export interface CandidateResults {
  markParsing(candidateId: string): Promise<boolean>;
  complete(candidateId: string, result: { name: string; cv: CV; lowConfidence: LowConfidence[] }): Promise<void>;
  fail(candidateId: string, error: string): Promise<void>;
}

export const CANDIDATE_RESULTS = Symbol.for("cvb.worker.CandidateResults");

@Injectable()
export class PrismaCandidateResults implements CandidateResults {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  /** False when the candidate was deleted meanwhile. */
  async markParsing(candidateId: string): Promise<boolean> {
    return (await this.db.candidate.updateMany({ where: { id: candidateId }, data: { status: "parsing" } })).count > 0;
  }

  async complete(candidateId: string, r: { name: string; cv: CV; lowConfidence: LowConfidence[] }): Promise<void> {
    await this.db.candidate.updateMany({
      where: { id: candidateId },
      data: { status: "ready", name: r.name, data: r.cv as object, lowConfidence: r.lowConfidence as object[], fileKey: "", error: "" },
    });
  }

  async fail(candidateId: string, error: string): Promise<void> {
    await this.db.candidate.updateMany({ where: { id: candidateId }, data: { status: "failed", error, fileKey: "" } });
  }
}
