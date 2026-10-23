import { DB } from "@cvb/db/nest";
import type { DbClient, Prisma } from "@cvb/db";
import { importFormat, type CV } from "@cvb/domain";
import { Inject, Injectable } from "@nestjs/common";

/** Port: records the outcome of an import (the new resume, or the failure). */
export interface ImportResults {
  markProcessing(importId: string): Promise<void>;
  complete(input: { importId: string; userId: string; title: string; cv: CV; warnings: string[] }): Promise<string>;
  fail(importId: string, error: string): Promise<void>;
}

export const IMPORT_RESULTS = Symbol.for("cvb.worker.ImportResults");

/** The server-side "import_finished" analytics event: the format and the outcome, never the file name. */
const importEvent = (userId: string, mimeType: string, fileName: string, ok: boolean, warnings?: number) => ({
  name: "import_finished",
  anonymousId: `u:${userId}`,
  userId,
  props: { format: importFormat(mimeType, fileName), ok, ...(warnings !== undefined ? { warnings } : {}) },
});

@Injectable()
export class PrismaImportResults implements ImportResults {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async markProcessing(importId: string): Promise<void> {
    await this.db.resumeImport.update({ where: { id: importId }, data: { status: "PROCESSING", error: null } });
  }

  /** Creates the resume and links it to the import in one transaction; safe to retry. */
  async complete({ importId, userId, title, cv, warnings }: Parameters<ImportResults["complete"]>[0]): Promise<string> {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.resumeImport.findUniqueOrThrow({ where: { id: importId }, select: { resumeId: true, mimeType: true, fileName: true } });
      if (existing.resumeId) return existing.resumeId;
      const resume = await tx.resume.create({
        data: { userId, title, templateId: "classic", data: cv as unknown as Prisma.InputJsonValue },
      });
      await tx.resumeImport.update({
        where: { id: importId },
        data: { status: "DONE", resumeId: resume.id, warnings: warnings as Prisma.InputJsonValue },
      });
      await tx.analyticsEvent.create({ data: importEvent(userId, existing.mimeType, existing.fileName, true, warnings.length) });
      return resume.id;
    });
  }

  async fail(importId: string, error: string): Promise<void> {
    const row = await this.db.resumeImport.update({ where: { id: importId }, data: { status: "FAILED", error } });
    await this.db.analyticsEvent.create({ data: importEvent(row.userId, row.mimeType, row.fileName, false) }).catch(() => undefined);
  }
}
