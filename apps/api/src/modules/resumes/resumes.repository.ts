import type { CV } from "@cvb/domain";

export type PageSize = "A4" | "LETTER";
export type ResumeStyle = { fontScale: number };

export type ResumeRecord = {
  id: string;
  userId: string;
  title: string;
  templateId: string;
  accent: string | null;
  pageSize: PageSize;
  style: ResumeStyle;
  data: CV;
  baseResumeId: string | null;
  jobId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewResume = Omit<ResumeRecord, "id" | "createdAt" | "updatedAt">;
export type ResumePatch = Partial<Pick<ResumeRecord, "title" | "templateId" | "accent" | "pageSize" | "style" | "data">>;

/** Persistence port for resumes. Swappable (Prisma today, an in-memory fake in tests). */
export interface ResumesRepository {
  listByUser(userId: string, page: { cursor?: string; limit: number }): Promise<{ items: ResumeRecord[]; nextCursor: string | null }>;
  countByUser(userId: string): Promise<number>;
  findOwned(id: string, userId: string): Promise<ResumeRecord | null>;
  create(input: NewResume): Promise<ResumeRecord>;
  /** Applies the patch; with `snapshotReason`, first stores the previous version in the same transaction. */
  update(id: string, patch: ResumePatch, snapshotReason?: string): Promise<ResumeRecord>;
  softDelete(id: string): Promise<void>;
  /** Deleted in the last 30 days, newest first. */
  listTrash(userId: string): Promise<ResumeRecord[]>;
  findDeleted(id: string, userId: string): Promise<ResumeRecord | null>;
  restore(id: string): Promise<ResumeRecord>;

  listVersions(resumeId: string): Promise<VersionRecord[]>;
  latestVersionAt(resumeId: string): Promise<Date | null>;
  /** Stores the resume's current content as a version. */
  snapshot(resumeId: string, reason: string): Promise<VersionRecord>;
  /** Saves the current content as "before-restore", then copies the version back. */
  restoreVersion(resumeId: string, versionId: string): Promise<ResumeRecord | null>;
  /** True when the job exists and belongs to the user (tailored copies link to a job). */
  jobOwned(jobId: string, userId: string): Promise<boolean>;
}

export type VersionRecord = { id: string; resumeId: string; reason: string; templateId: string; createdAt: Date };

export const RESUMES_REPOSITORY = Symbol.for("cvb.api.ResumesRepository");
