import { DB } from "@cvb/db/nest";
import type { DbClient, Prisma, Resume } from "@cvb/db";
import { normalizeCV } from "@cvb/domain";
import { Inject, Injectable } from "@nestjs/common";
import type { NewResume, ResumePatch, ResumeRecord, ResumesRepository, VersionRecord } from "./resumes.repository.js";

const TRASH_DAYS = 30;

const toStyle = (v: unknown): { fontScale: number } => {
  const n = (v as { fontScale?: unknown } | null)?.fontScale;
  return { fontScale: typeof n === "number" && n >= 0.7 && n <= 1.15 ? n : 1 };
};

/** Rows are normalised on the way out, so old or hand-edited JSON can never crash a template. */
const toRecord = (r: Resume): ResumeRecord => ({
  id: r.id,
  userId: r.userId,
  title: r.title,
  templateId: r.templateId,
  accent: r.accent,
  pageSize: r.pageSize,
  style: toStyle(r.style),
  data: normalizeCV(r.data),
  baseResumeId: r.baseResumeId,
  jobId: r.jobId,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

const json = (v: unknown) => v as Prisma.InputJsonValue;

@Injectable()
export class PrismaResumesRepository implements ResumesRepository {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async listByUser(userId: string, { cursor, limit }: { cursor?: string; limit: number }) {
    const rows = await this.db.resume.findMany({
      where: { userId, deletedAt: null, archivedAt: null },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map(toRecord);
    return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
  }

  countByUser(userId: string): Promise<number> {
    return this.db.resume.count({ where: { userId, deletedAt: null } });
  }

  async findOwned(id: string, userId: string): Promise<ResumeRecord | null> {
    const r = await this.db.resume.findFirst({ where: { id, userId, deletedAt: null } });
    return r && toRecord(r);
  }

  async create(input: NewResume): Promise<ResumeRecord> {
    return toRecord(await this.db.resume.create({ data: { ...input, data: json(input.data), style: json(input.style) } }));
  }

  async update(id: string, patch: ResumePatch, snapshotReason?: string): Promise<ResumeRecord> {
    const data = { ...patch, ...(patch.data ? { data: json(patch.data) } : {}), ...(patch.style ? { style: json(patch.style) } : {}) };
    return this.db.$transaction(async (tx) => {
      if (snapshotReason) {
        const prev = await tx.resume.findUniqueOrThrow({ where: { id } });
        await tx.resumeVersion.create({
          data: { resumeId: id, data: json(prev.data), templateId: prev.templateId, reason: snapshotReason },
        });
      }
      return toRecord(await tx.resume.update({ where: { id }, data }));
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.db.resume.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async listTrash(userId: string): Promise<ResumeRecord[]> {
    const since = new Date(Date.now() - TRASH_DAYS * 24 * 3600 * 1000);
    const rows = await this.db.resume.findMany({
      where: { userId, deletedAt: { gte: since } },
      orderBy: { deletedAt: "desc" },
    });
    return rows.map(toRecord);
  }

  async findDeleted(id: string, userId: string): Promise<ResumeRecord | null> {
    const r = await this.db.resume.findFirst({ where: { id, userId, deletedAt: { not: null } } });
    return r && toRecord(r);
  }

  async restore(id: string): Promise<ResumeRecord> {
    return toRecord(await this.db.resume.update({ where: { id }, data: { deletedAt: null } }));
  }

  async listVersions(resumeId: string): Promise<VersionRecord[]> {
    return this.db.resumeVersion.findMany({
      where: { resumeId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, resumeId: true, reason: true, templateId: true, createdAt: true },
    });
  }

  async latestVersionAt(resumeId: string): Promise<Date | null> {
    const v = await this.db.resumeVersion.findFirst({ where: { resumeId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    return v?.createdAt ?? null;
  }

  async snapshot(resumeId: string, reason: string): Promise<VersionRecord> {
    const current = await this.db.resume.findUniqueOrThrow({ where: { id: resumeId } });
    return this.db.resumeVersion.create({
      data: { resumeId, data: json(current.data), templateId: current.templateId, reason },
      select: { id: true, resumeId: true, reason: true, templateId: true, createdAt: true },
    });
  }

  async restoreVersion(resumeId: string, versionId: string): Promise<ResumeRecord | null> {
    return this.db.$transaction(async (tx) => {
      const version = await tx.resumeVersion.findFirst({ where: { id: versionId, resumeId } });
      if (!version) return null;
      const current = await tx.resume.findUniqueOrThrow({ where: { id: resumeId } });
      await tx.resumeVersion.create({
        data: { resumeId, data: json(current.data), templateId: current.templateId, reason: "before-restore" },
      });
      return toRecord(
        await tx.resume.update({ where: { id: resumeId }, data: { data: json(version.data), templateId: version.templateId } }),
      );
    });
  }

  async jobOwned(jobId: string, userId: string): Promise<boolean> {
    return (await this.db.job.count({ where: { id: jobId, userId, deletedAt: null } })) > 0;
  }
}
