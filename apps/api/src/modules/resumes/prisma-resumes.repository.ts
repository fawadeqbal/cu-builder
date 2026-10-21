import { DB } from "@cvb/db/nest";
import type { DbClient, Prisma, Resume } from "@cvb/db";
import { normalizeCV } from "@cvb/domain";
import { Inject, Injectable } from "@nestjs/common";
import type { NewResume, ResumePatch, ResumeRecord, ResumesRepository } from "./resumes.repository.js";

/** Rows are normalised on the way out, so old or hand-edited JSON can never crash a template. */
const toRecord = (r: Resume): ResumeRecord => ({
  id: r.id,
  userId: r.userId,
  title: r.title,
  templateId: r.templateId,
  accent: r.accent,
  pageSize: r.pageSize,
  data: normalizeCV(r.data),
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
    return toRecord(await this.db.resume.create({ data: { ...input, data: json(input.data) } }));
  }

  async update(id: string, patch: ResumePatch, snapshotReason?: string): Promise<ResumeRecord> {
    const data = { ...patch, ...(patch.data ? { data: json(patch.data) } : {}) };
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
}
