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
  label: string | null;
  notifyOnView: boolean;
  lastNotifiedAt: Date | null;
  createdAt: Date;
};

export type ViewInput = { visitor: string; referrer: string | null; country: string | null; device: string | null };
export type ViewRow = { viewedAt: Date; visitor: string; durationMs: number; downloaded: boolean; referrer: string | null; country: string | null; device: string | null };

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
  create(input: { resumeId: string; slug: string; passwordHash: string | null; expiresAt: Date | null; label: string | null }): Promise<ShareLinkRecord>;
  update(
    id: string,
    patch: Partial<Pick<ShareLinkRecord, "enabled" | "slug" | "passwordHash" | "expiresAt" | "label" | "notifyOnView" | "lastNotifiedAt">>,
  ): Promise<ShareLinkRecord>;
  delete(id: string): Promise<void>;
  /** Counts a view, stores its details and returns the new total and the view's id. */
  recordView(id: string, view: ViewInput): Promise<{ views: number; viewId: string }>;
  /** Updates time on page / download for a view of the link with this slug. */
  pingView(slug: string, viewId: string, patch: { durationMs?: number; downloaded?: boolean }): Promise<void>;
  views(linkId: string, since: Date): Promise<ViewRow[]>;
}

export const SHARE_LINKS_REPOSITORY = Symbol.for("cvb.api.ShareLinksRepository");
