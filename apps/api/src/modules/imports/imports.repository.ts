export type ImportStatus = "queued" | "processing" | "done" | "failed";

export type ImportRecord = {
  id: string;
  userId: string;
  fileKey: string;
  fileName: string;
  mimeType: string;
  status: ImportStatus;
  error: string | null;
  warnings: string[];
  resumeId: string | null;
  createdAt: Date;
};

export interface ImportsRepository {
  create(input: { userId: string; fileKey: string; fileName: string; mimeType: string }): Promise<ImportRecord>;
  findOwned(id: string, userId: string): Promise<ImportRecord | null>;
  listRecent(userId: string, limit: number): Promise<ImportRecord[]>;
  markFailed(id: string, error: string): Promise<void>;
}

export const IMPORTS_REPOSITORY = Symbol.for("cvb.api.ImportsRepository");
