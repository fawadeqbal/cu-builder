import type { Plan } from "@cvb/domain";

export type UserRecord = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  emailVerified: boolean;
  role: "user" | "admin";
  plan: Plan;
  locale: string;
  createdAt: Date;
};

/** Persistence port for users. Sign-up itself belongs to Better Auth; this covers profile reads and edits. */
export interface UsersRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  /** Development sign-in only. */
  create(input: { email: string; name: string }): Promise<UserRecord>;
  update(id: string, patch: { name?: string; locale?: string }): Promise<UserRecord>;
  /** Everything stored about the user, for "export all data" (GDPR article 20). */
  exportData(id: string): Promise<Record<string, unknown>>;
}

export const USERS_REPOSITORY = Symbol.for("cvb.api.UsersRepository");
