import type { CV, LowConfidence } from "@cvb/domain";

export type CandidateRecord = {
  id: string;
  orgId: string;
  createdById: string;
  batchId: string;
  name: string;
  status: "queued" | "parsing" | "ready" | "failed";
  fileKey: string;
  fileName: string;
  mimeType: string;
  data: CV | null;
  lowConfidence: LowConfidence[];
  hideContacts: boolean;
  templateId: string | null;
  error: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CandidatePatch = Partial<Pick<CandidateRecord, "data" | "name" | "hideContacts" | "templateId" | "lowConfidence" | "status" | "fileKey" | "error">>;

/** Persistence port for agency candidates. */
export interface CandidatesStore {
  create(input: Pick<CandidateRecord, "orgId" | "createdById" | "batchId" | "fileKey" | "fileName" | "mimeType" | "templateId">): Promise<CandidateRecord>;
  list(orgId: string, batchId?: string): Promise<CandidateRecord[]>;
  find(id: string, orgId: string): Promise<CandidateRecord | null>;
  update(id: string, patch: CandidatePatch): Promise<CandidateRecord>;
  delete(id: string): Promise<void>;
}

export const CANDIDATES_STORE = Symbol.for("cvb.api.CandidatesStore");
