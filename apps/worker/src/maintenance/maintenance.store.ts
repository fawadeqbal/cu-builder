import { DB } from "@cvb/db/nest";
import type { DbClient } from "@cvb/db";
import { Inject, Injectable } from "@nestjs/common";

/** What the daily clean-up removes. A port, so the rules can be tested without a database. */
export interface MaintenanceStore {
  /** Permanently deletes CVs that have been in the trash since before `before`. */
  purgeTrash(before: Date): Promise<number>;
  /** Upload files of imports created before `before`; their keys are cleared once the files are gone. */
  oldImportFiles(before: Date): Promise<{ id: string; fileKey: string }[]>;
  forgetImportFile(id: string): Promise<void>;
  purgeExpiredTokens(now: Date): Promise<number>;
}

export const MAINTENANCE_STORE = Symbol.for("cvb.worker.MaintenanceStore");

@Injectable()
export class PrismaMaintenanceStore implements MaintenanceStore {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async purgeTrash(before: Date): Promise<number> {
    return (await this.db.resume.deleteMany({ where: { deletedAt: { lt: before } } })).count;
  }

  oldImportFiles(before: Date): Promise<{ id: string; fileKey: string }[]> {
    return this.db.resumeImport.findMany({ where: { createdAt: { lt: before }, fileKey: { not: "" } }, select: { id: true, fileKey: true }, take: 500 });
  }

  async forgetImportFile(id: string): Promise<void> {
    await this.db.resumeImport.update({ where: { id }, data: { fileKey: "" } });
  }

  async purgeExpiredTokens(now: Date): Promise<number> {
    return (await this.db.verification.deleteMany({ where: { expiresAt: { lt: now } } })).count;
  }
}
