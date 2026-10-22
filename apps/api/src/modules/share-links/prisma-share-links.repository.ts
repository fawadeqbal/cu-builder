import { DB } from "@cvb/db/nest";
import type { DbClient, ShareLink } from "@cvb/db";
import { normalizeCV } from "@cvb/domain";
import { Inject, Injectable } from "@nestjs/common";
import type { ShareLinkRecord, ShareLinksRepository, SharedResume, ViewInput } from "./share-links.repository.js";

type Row = ShareLink & { resume: { userId: string } };

const toRecord = (l: Row): ShareLinkRecord => ({
  id: l.id,
  resumeId: l.resumeId,
  ownerId: l.resume.userId,
  slug: l.slug,
  enabled: l.enabled,
  passwordHash: l.passwordHash,
  expiresAt: l.expiresAt,
  viewCount: l.viewCount,
  lastViewedAt: l.lastViewedAt,
  label: l.label,
  notifyOnView: l.notifyOnView,
  lastNotifiedAt: l.lastNotifiedAt,
  createdAt: l.createdAt,
});

const withOwner = { resume: { select: { userId: true } } } as const;

@Injectable()
export class PrismaShareLinksRepository implements ShareLinksRepository {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async listForResume(resumeId: string) {
    const rows = await this.db.shareLink.findMany({ where: { resumeId }, include: withOwner, orderBy: { createdAt: "desc" } });
    return rows.map(toRecord);
  }

  async findById(id: string) {
    const row = await this.db.shareLink.findUnique({ where: { id }, include: withOwner });
    return row && toRecord(row);
  }

  async findBySlug(slug: string): Promise<SharedResume | null> {
    const row = await this.db.shareLink.findUnique({
      where: { slug },
      include: { resume: { include: { user: { select: { name: true, email: true } } } } },
    });
    if (!row) return null;
    const r = row.resume;
    return {
      link: toRecord({ ...row, resume: { userId: r.userId } }),
      resume: {
        title: r.title,
        templateId: r.templateId,
        accent: r.accent,
        pageSize: r.pageSize,
        data: normalizeCV(r.data),
        deleted: Boolean(r.deletedAt),
      },
      owner: { name: r.user.name, email: r.user.email },
    };
  }

  async slugTaken(slug: string) {
    return (await this.db.shareLink.count({ where: { slug } })) > 0;
  }

  async create(input: { resumeId: string; slug: string; passwordHash: string | null; expiresAt: Date | null; label: string | null }) {
    return toRecord(await this.db.shareLink.create({ data: input, include: withOwner }));
  }

  async update(id: string, patch: Parameters<ShareLinksRepository["update"]>[1]) {
    return toRecord(await this.db.shareLink.update({ where: { id }, data: patch, include: withOwner }));
  }

  async delete(id: string) {
    await this.db.shareLink.delete({ where: { id } });
  }

  async recordView(id: string, view: ViewInput) {
    const [row, created] = await this.db.$transaction([
      this.db.shareLink.update({ where: { id }, data: { viewCount: { increment: 1 }, lastViewedAt: new Date() }, select: { viewCount: true } }),
      this.db.linkView.create({ data: { shareLinkId: id, ...view }, select: { id: true } }),
    ]);
    return { views: row.viewCount, viewId: created.id };
  }

  async pingView(slug: string, viewId: string, patch: { durationMs?: number; downloaded?: boolean }) {
    await this.db.linkView.updateMany({
      where: { id: viewId, shareLink: { slug } },
      data: { ...(patch.durationMs !== undefined ? { durationMs: patch.durationMs } : {}), ...(patch.downloaded ? { downloaded: true } : {}) },
    });
  }

  async views(linkId: string, since: Date) {
    return this.db.linkView.findMany({
      where: { shareLinkId: linkId, viewedAt: { gte: since } },
      orderBy: { viewedAt: "desc" },
      take: 5000,
      select: { viewedAt: true, visitor: true, durationMs: true, downloaded: true, referrer: true, country: true, device: true },
    });
  }
}
