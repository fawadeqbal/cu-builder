import { DB } from "@cvb/db/nest";
import type { DbClient, Review } from "@cvb/db";
import { REVIEW_STATUSES, type ReviewStatus } from "@cvb/domain";
import { Inject, Injectable } from "@nestjs/common";
import type { ReviewRecord, ReviewsRepository, ReviewWithAuthor, ReviewWrite } from "./reviews.repository.js";

const asStatus = (s: string): ReviewStatus =>
  (REVIEW_STATUSES as readonly string[]).includes(s) ? (s as ReviewStatus) : "pending";

const toRecord = (r: Review): ReviewRecord => ({
  id: r.id,
  userId: r.userId,
  rating: r.rating,
  text: r.text,
  displayName: r.displayName,
  jobTitle: r.jobTitle,
  status: asStatus(r.status),
  moderatedAt: r.moderatedAt,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

@Injectable()
export class PrismaReviewsRepository implements ReviewsRepository {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async findByUser(userId: string) {
    const r = await this.db.review.findUnique({ where: { userId } });
    return r && toRecord(r);
  }

  async saveForUser(userId: string, data: ReviewWrite) {
    const r = await this.db.review.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    return toRecord(r);
  }

  async deleteForUser(userId: string) {
    await this.db.review.deleteMany({ where: { userId } });
  }

  async list(filter: { status?: ReviewStatus }, { cursor, limit }: { cursor?: string; limit: number }) {
    const rows = await this.db.review.findMany({
      where: filter.status ? { status: filter.status } : {},
      include: { user: { select: { email: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const items: ReviewWithAuthor[] = rows.slice(0, limit).map((r) => ({ ...toRecord(r), userEmail: r.user.email }));
    return { items, nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null };
  }

  async setStatus(id: string, status: ReviewStatus, at: Date) {
    const hit = await this.db.review.updateMany({ where: { id }, data: { status, moderatedAt: at } });
    if (!hit.count) return null;
    const r = await this.db.review.findUnique({ where: { id } });
    return r && toRecord(r);
  }
}
