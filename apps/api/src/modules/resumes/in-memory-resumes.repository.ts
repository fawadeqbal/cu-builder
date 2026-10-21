import type { NewResume, ResumePatch, ResumeRecord, ResumesRepository } from "./resumes.repository.js";

/** Test double for ResumesRepository. Same behaviour as the Prisma adapter, kept in memory. */
export class InMemoryResumesRepository implements ResumesRepository {
  private rows = new Map<string, ResumeRecord & { deleted?: boolean }>();
  readonly versions: { resumeId: string; reason: string }[] = [];
  private seq = 0;

  async listByUser(userId: string, { limit }: { cursor?: string; limit: number }) {
    const items = [...this.rows.values()].filter((r) => r.userId === userId && !r.deleted).slice(0, limit);
    return { items, nextCursor: null };
  }

  async countByUser(userId: string) {
    return [...this.rows.values()].filter((r) => r.userId === userId && !r.deleted).length;
  }

  async findOwned(id: string, userId: string) {
    const r = this.rows.get(id);
    return r && r.userId === userId && !r.deleted ? r : null;
  }

  async create(input: NewResume) {
    const now = new Date();
    const row = { ...input, id: `r${++this.seq}`, createdAt: now, updatedAt: now };
    this.rows.set(row.id, row);
    return row;
  }

  async update(id: string, patch: ResumePatch, snapshotReason?: string) {
    const row = this.rows.get(id)!;
    if (snapshotReason) this.versions.push({ resumeId: id, reason: snapshotReason });
    const next = { ...row, ...patch, updatedAt: new Date() };
    this.rows.set(id, next);
    return next;
  }

  async softDelete(id: string) {
    const row = this.rows.get(id);
    if (row) row.deleted = true;
  }
}
