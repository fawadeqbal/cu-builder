import { DB } from "@cvb/db/nest";
import type { DbClient, ResumeImport } from "@cvb/db";
import { Inject, Injectable } from "@nestjs/common";
import type { ImportRecord, ImportStatus, ImportsRepository } from "./imports.repository.js";

const toRecord = (r: ResumeImport): ImportRecord => ({
  id: r.id,
  userId: r.userId,
  fileKey: r.fileKey,
  fileName: r.fileName,
  mimeType: r.mimeType,
  status: r.status.toLowerCase() as ImportStatus,
  error: r.error,
  warnings: Array.isArray(r.warnings) ? (r.warnings as unknown[]).filter((w): w is string => typeof w === "string") : [],
  resumeId: r.resumeId,
  createdAt: r.createdAt,
});

@Injectable()
export class PrismaImportsRepository implements ImportsRepository {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async create(input: { userId: string; fileKey: string; fileName: string; mimeType: string }) {
    return toRecord(await this.db.resumeImport.create({ data: input }));
  }

  async findOwned(id: string, userId: string) {
    const r = await this.db.resumeImport.findFirst({ where: { id, userId } });
    return r && toRecord(r);
  }

  async listRecent(userId: string, limit: number) {
    const rows = await this.db.resumeImport.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit });
    return rows.map(toRecord);
  }

  async markFailed(id: string, error: string) {
    await this.db.resumeImport.update({ where: { id }, data: { status: "FAILED", error } });
  }
}
