import { DB } from "@cvb/db/nest";
import { planToDomain, type DbClient, type User } from "@cvb/db";
import { Inject, Injectable } from "@nestjs/common";
import type { UserRecord, UsersRepository } from "./users.repository.js";

const toRecord = (u: User): UserRecord => ({
  id: u.id,
  email: u.email,
  name: u.name,
  plan: planToDomain(u.plan),
  createdAt: u.createdAt,
});

@Injectable()
export class PrismaUsersRepository implements UsersRepository {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    const u = await this.db.user.findFirst({ where: { email, deletedAt: null } });
    return u && toRecord(u);
  }

  async findById(id: string): Promise<UserRecord | null> {
    const u = await this.db.user.findFirst({ where: { id, deletedAt: null } });
    return u && toRecord(u);
  }

  async create(input: { email: string; name?: string | null }): Promise<UserRecord> {
    return toRecord(await this.db.user.create({ data: { email: input.email, name: input.name ?? null } }));
  }
}
