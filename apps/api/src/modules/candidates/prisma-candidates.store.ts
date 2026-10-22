import { DB } from "@cvb/db/nest";
import type { Candidate, DbClient } from "@cvb/db";
import { normalizeCV, type LowConfidence } from "@cvb/domain";
import { Inject, Injectable } from "@nestjs/common";
import type { CandidatePatch, CandidateRecord, CandidatesStore } from "./candidates.store.js";

const STATUSES = new Set(["queued", "parsing", "ready", "failed"]);

export const toCandidate = (c: Candidate): CandidateRecord => ({
  id: c.id,
  orgId: c.orgId,
  createdById: c.createdById,
  batchId: c.batchId,
  name: c.name,
  status: (STATUSES.has(c.status) ? c.status : "failed") as CandidateRecord["status"],
  fileKey: c.fileKey,
  fileName: c.fileName,
  mimeType: c.mimeType,
  data: c.data ? normalizeCV(c.data) : null,
  lowConfidence: Array.isArray(c.lowConfidence) ? (c.lowConfidence as LowConfidence[]) : [],
  hideContacts: c.hideContacts,
  templateId: c.templateId,
  error: c.error,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

@Injectable()
export class PrismaCandidatesStore implements CandidatesStore {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async create(input: Pick<CandidateRecord, "orgId" | "createdById" | "batchId" | "fileKey" | "fileName" | "mimeType" | "templateId">) {
    return toCandidate(await this.db.candidate.create({ data: input }));
  }

  async list(orgId: string, batchId?: string) {
    return (await this.db.candidate.findMany({ where: { orgId, ...(batchId ? { batchId } : {}) }, orderBy: { createdAt: "desc" }, take: 1000 })).map(toCandidate);
  }

  async find(id: string, orgId: string) {
    const c = await this.db.candidate.findFirst({ where: { id, orgId } });
    return c && toCandidate(c);
  }

  async update(id: string, patch: CandidatePatch) {
    const { data, lowConfidence, ...rest } = patch;
    return toCandidate(
      await this.db.candidate.update({
        where: { id },
        data: { ...rest, ...(data !== undefined ? { data: data as object } : {}), ...(lowConfidence ? { lowConfidence: lowConfidence as object[] } : {}) },
      }),
    );
  }

  async delete(id: string) {
    await this.db.candidate.delete({ where: { id } });
  }
}
