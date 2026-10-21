import type { Plan } from "@cvb/domain";

export type UserRecord = { id: string; email: string; name: string | null; plan: Plan; createdAt: Date };

/** Persistence port for users. The service depends on this, not on Prisma. */
export interface UsersRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(input: { email: string; name?: string | null }): Promise<UserRecord>;
}

export const USERS_REPOSITORY = Symbol.for("cvb.api.UsersRepository");
