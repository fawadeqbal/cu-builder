import { LetterDataSchema } from "@cvb/contracts";
import { DB } from "@cvb/db/nest";
import type { CoverLetter, DbClient, Prisma } from "@cvb/db";
import { Inject, Injectable } from "@nestjs/common";
import type { CoverLetterPatch, CoverLetterRecord, CoverLettersRepository, NewCoverLetter } from "./cover-letters.repository.js";

const toRecord = (c: CoverLetter): CoverLetterRecord => ({
  id: c.id,
  userId: c.userId,
  resumeId: c.resumeId,
  jobId: c.jobId,
  title: c.title,
  templateId: c.templateId,
  accent: c.accent,
  pageSize: c.pageSize,
  data: LetterDataSchema.parse(c.data ?? {}),
  shareSlug: c.shareSlug,
  shareEnabled: c.shareEnabled,
  viewCount: c.viewCount,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

const json = (v: unknown) => v as Prisma.InputJsonValue;

@Injectable()
export class PrismaCoverLettersRepository implements CoverLettersRepository {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async list(userId: string) {
    return (await this.db.coverLetter.findMany({ where: { userId, deletedAt: null }, orderBy: { updatedAt: "desc" } })).map(toRecord);
  }

  async findOwned(id: string, userId: string) {
    const c = await this.db.coverLetter.findFirst({ where: { id, userId, deletedAt: null } });
    return c && toRecord(c);
  }

  async create(input: NewCoverLetter) {
    return toRecord(await this.db.coverLetter.create({ data: { ...input, data: json(input.data) } }));
  }

  async update(id: string, patch: CoverLetterPatch) {
    return toRecord(await this.db.coverLetter.update({ where: { id }, data: { ...patch, ...(patch.data ? { data: json(patch.data) } : {}) } }));
  }

  async softDelete(id: string) {
    await this.db.coverLetter.update({ where: { id }, data: { deletedAt: new Date(), shareEnabled: false } });
  }

  async slugTaken(slug: string) {
    return (await this.db.coverLetter.count({ where: { shareSlug: slug } })) > 0;
  }

  async viewShared(slug: string) {
    const found = await this.db.coverLetter.findFirst({ where: { shareSlug: slug, shareEnabled: true, deletedAt: null } });
    if (!found) return null;
    await this.db.coverLetter.update({ where: { id: found.id }, data: { viewCount: { increment: 1 } } });
    return toRecord(found);
  }
}
