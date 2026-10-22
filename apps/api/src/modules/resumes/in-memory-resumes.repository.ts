import type { NewResume, ResumePatch, ResumeRecord, ResumesRepository, VersionRecord } from "./resumes.repository.js";

/** Test double for ResumesRepository. Same behaviour as the Prisma adapter, kept in memory. */
export class InMemoryResumesRepository implements ResumesRepository {
  private rows = new Map<string, ResumeRecord & { deleted?: boolean }>();
  readonly versions: (VersionRecord & { data: ResumeRecord["data"] })[] = [];
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
    if (snapshotReason) await this.snapshot(id, snapshotReason);
    const next = { ...row, ...patch, updatedAt: new Date() };
    this.rows.set(id, next);
    return next;
  }

  async softDelete(id: string) {
    const row = this.rows.get(id);
    if (row) row.deleted = true;
  }

  async listTrash(userId: string) {
    return [...this.rows.values()].filter((r) => r.userId === userId && r.deleted);
  }

  async findDeleted(id: string, userId: string) {
    const r = this.rows.get(id);
    return r && r.userId === userId && r.deleted ? r : null;
  }

  async restore(id: string) {
    const r = this.rows.get(id)!;
    r.deleted = false;
    return r;
  }

  async listVersions(resumeId: string) {
    return this.versions.filter((v) => v.resumeId === resumeId).reverse();
  }

  async latestVersionAt(resumeId: string) {
    return this.versions.filter((v) => v.resumeId === resumeId).at(-1)?.createdAt ?? null;
  }

  async snapshot(resumeId: string, reason: string) {
    const row = this.rows.get(resumeId)!;
    const v = { id: `v${this.versions.length + 1}`, resumeId, reason, templateId: row.templateId, createdAt: new Date(), data: row.data };
    this.versions.push(v);
    return v;
  }

  async restoreVersion(resumeId: string, versionId: string) {
    const v = this.versions.find((x) => x.id === versionId && x.resumeId === resumeId);
    if (!v) return null;
    await this.snapshot(resumeId, "before-restore");
    const row = { ...this.rows.get(resumeId)!, data: v.data, templateId: v.templateId };
    this.rows.set(resumeId, row);
    return row;
  }

  readonly jobs = new Set<string>();
  async jobOwned(jobId: string, userId: string): Promise<boolean> {
    return this.jobs.has(`${userId}:${jobId}`);
  }
}
