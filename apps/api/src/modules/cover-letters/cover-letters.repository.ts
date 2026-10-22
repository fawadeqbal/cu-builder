import type { LetterData } from "@cvb/contracts";

export type CoverLetterRecord = {
  id: string;
  userId: string;
  resumeId: string | null;
  jobId: string | null;
  title: string;
  templateId: string;
  accent: string | null;
  pageSize: "A4" | "LETTER";
  data: LetterData;
  shareSlug: string | null;
  shareEnabled: boolean;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type NewCoverLetter = Omit<CoverLetterRecord, "id" | "createdAt" | "updatedAt" | "shareSlug" | "shareEnabled" | "viewCount">;
export type CoverLetterPatch = Partial<Omit<NewCoverLetter, "userId">> & { shareSlug?: string | null; shareEnabled?: boolean };

export interface CoverLettersRepository {
  list(userId: string): Promise<CoverLetterRecord[]>;
  findOwned(id: string, userId: string): Promise<CoverLetterRecord | null>;
  create(input: NewCoverLetter): Promise<CoverLetterRecord>;
  update(id: string, patch: CoverLetterPatch): Promise<CoverLetterRecord>;
  softDelete(id: string): Promise<void>;
  slugTaken(slug: string): Promise<boolean>;
  /** The shared letter for a public slug, counting the view. */
  viewShared(slug: string): Promise<CoverLetterRecord | null>;
}

export const COVER_LETTERS_REPOSITORY = Symbol.for("cvb.api.CoverLettersRepository");
