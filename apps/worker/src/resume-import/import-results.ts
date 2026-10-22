import { DB } from "@cvb/db/nest";
import type { DbClient, Prisma } from "@cvb/db";
import type { CV } from "@cvb/domain";
import { Inject, Injectable } from "@nestjs/common";

/** Port: records the outcome of an import (the new resume, or the failure). */
export interface ImportResults {
  markProcessing(importId: string): Promise<void>;
  complete(input: { importId: string; userId: string; title: string; cv: CV; warnings: string[] }): Promise<string>;
  fail(importId: string, error: string): Promise<void>;
}

export const IMPORT_RESULTS = Symbol.for("cvb.worker.ImportResults");

@Injectable()
export class PrismaImportResults implements ImportResults {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async markProcessing(importId: string): Promise<void> {
    await this.db.resumeImport.update({ where: { id: importId }, data: { status: "PROCESSING", error: null } });
  }

  /** Creates the resume and links it to the import in one transaction; safe to retry. */
  async complete({ importId, userId, title, cv, warnings }: Parameters<ImportResults["complete"]>[0]): Promise<string> {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.resumeImport.findUniqueOrThrow({ where: { id: importId }, select: { resumeId: true } });
      if (existing.resumeId) return existing.resumeId;
      const resume = await tx.resume.create({
        data: { userId, title, templateId: "classic", data: cv as unknown as Prisma.InputJsonValue },
      });
      await tx.resumeImport.update({
        where: { id: importId },
        data: { status: "DONE", resumeId: resume.id, warnings: warnings as Prisma.InputJsonValue },
      });
      return resume.id;
    });
  }

  async fail(importId: string, error: string): Promise<void> {
    await this.db.resumeImport.update({ where: { id: importId }, data: { status: "FAILED", error } });
  }
}
