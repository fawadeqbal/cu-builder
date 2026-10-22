import type { ReviewStatus } from "@cvb/domain";

export type ReviewRecord = {
  id: string;
  userId: string;
  rating: number;
  text: string;
  displayName: string;
  jobTitle: string | null;
  status: ReviewStatus;
  moderatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ReviewWithAuthor = ReviewRecord & { userEmail: string };

export type ReviewWrite = Pick<ReviewRecord, "rating" | "text" | "displayName" | "jobTitle" | "status">;

/** Persistence port for reviews (Prisma in the app, in memory in tests). Lists are newest first. */
export interface ReviewsRepository {
  findByUser(userId: string): Promise<ReviewRecord | null>;
  /** Creates the user's review or replaces its content (one per user). */
  saveForUser(userId: string, data: ReviewWrite): Promise<ReviewRecord>;
  deleteForUser(userId: string): Promise<void>;
  list(
    filter: { status?: ReviewStatus },
    page: { cursor?: string; limit: number },
  ): Promise<{ items: ReviewWithAuthor[]; nextCursor: string | null }>;
  /** Null when there is no such review. */
  setStatus(id: string, status: ReviewStatus, at: Date): Promise<ReviewRecord | null>;
}

export const REVIEWS_REPOSITORY = Symbol.for("cvb.api.ReviewsRepository");
