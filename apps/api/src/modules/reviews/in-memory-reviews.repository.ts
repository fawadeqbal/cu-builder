import type { ReviewStatus } from "@cvb/domain";
import type { ReviewRecord, ReviewsRepository, ReviewWithAuthor, ReviewWrite } from "./reviews.repository.js";

/** Test double for ReviewsRepository, same ordering and paging as the Prisma adapter. */
export class InMemoryReviewsRepository implements ReviewsRepository {
  readonly rows: ReviewRecord[] = [];
  private seq = 0;
  private clock = 0;

  constructor(private readonly emails: (userId: string) => string = (id) => `${id}@example.com`) {}

  async findByUser(userId: string) {
    return this.rows.find((r) => r.userId === userId) ?? null;
  }

  async saveForUser(userId: string, data: ReviewWrite) {
    const now = new Date(Date.UTC(2026, 0, 1) + ++this.clock * 1000);
    const existing = this.rows.find((r) => r.userId === userId);
    if (existing) {
      Object.assign(existing, data, { updatedAt: now });
      return existing;
    }
    const row: ReviewRecord = {
      id: `rv${++this.seq}`,
      userId,
      ...data,
      moderatedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.push(row);
    return row;
  }

  async deleteForUser(userId: string) {
    const i = this.rows.findIndex((r) => r.userId === userId);
    if (i >= 0) this.rows.splice(i, 1);
  }

  async list(filter: { status?: ReviewStatus }, { cursor, limit }: { cursor?: string; limit: number }) {
    const all = this.rows
      .filter((r) => !filter.status || r.status === filter.status)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
    const start = cursor ? all.findIndex((r) => r.id === cursor) + 1 : 0;
    const page = all.slice(start, start + limit + 1);
    const items: ReviewWithAuthor[] = page.slice(0, limit).map((r) => ({ ...r, userEmail: this.emails(r.userId) }));
    return { items, nextCursor: page.length > limit ? (items.at(-1)?.id ?? null) : null };
  }

  async setStatus(id: string, status: ReviewStatus, at: Date) {
    const r = this.rows.find((x) => x.id === id);
    if (!r) return null;
    r.status = status;
    r.moderatedAt = at;
    return r;
  }
}
