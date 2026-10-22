import type { CV } from "@cvb/domain";

export type ShareLinkRecord = {
  id: string;
  resumeId: string;
  ownerId: string;
  slug: string;
  enabled: boolean;
  passwordHash: string | null;
  expiresAt: Date | null;
  viewCount: number;
  lastViewedAt: Date | null;
  createdAt: Date;
};

export type SharedResume = {
  link: ShareLinkRecord;
  resume: { title: string; templateId: string; accent: string | null; pageSize: "A4" | "LETTER"; data: CV; deleted: boolean };
  owner: { name: string; email: string };
};

export interface ShareLinksRepository {
  listForResume(resumeId: string): Promise<ShareLinkRecord[]>;
  findById(id: string): Promise<ShareLinkRecord | null>;
  findBySlug(slug: string): Promise<SharedResume | null>;
  slugTaken(slug: string): Promise<boolean>;
  create(input: { resumeId: string; slug: string; passwordHash: string | null; expiresAt: Date | null }): Promise<ShareLinkRecord>;
  update(
    id: string,
    patch: Partial<Pick<ShareLinkRecord, "enabled" | "slug" | "passwordHash" | "expiresAt">>,
  ): Promise<ShareLinkRecord>;
  delete(id: string): Promise<void>;
  /** Counts a view and returns the new total. */
  recordView(id: string): Promise<number>;
}

export const SHARE_LINKS_REPOSITORY = Symbol.for("cvb.api.ShareLinksRepository");
