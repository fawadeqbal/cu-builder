import { DB } from "@cvb/db/nest";
import { planToDomain, type DbClient, type User } from "@cvb/db";
import { Inject, Injectable } from "@nestjs/common";
import type { UserRecord, UsersRepository } from "./users.repository.js";

const toRecord = (u: User): UserRecord => ({
  id: u.id,
  email: u.email,
  name: u.name,
  image: u.image,
  emailVerified: u.emailVerified,
  role: u.role === "admin" ? "admin" : "user",
  plan: planToDomain(u.plan),
  locale: u.locale,
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

  async create(input: { email: string; name: string }): Promise<UserRecord> {
    return toRecord(await this.db.user.create({ data: { email: input.email, name: input.name } }));
  }

  async update(id: string, patch: { name?: string; locale?: string }): Promise<UserRecord> {
    return toRecord(await this.db.user.update({ where: { id }, data: patch }));
  }

  async exportData(id: string): Promise<Record<string, unknown>> {
    const user = await this.db.user.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        locale: true,
        plan: true,
        createdAt: true,
        accounts: { select: { providerId: true, createdAt: true } },
        resumes: {
          select: {
            id: true,
            title: true,
            templateId: true,
            accent: true,
            pageSize: true,
            data: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true,
            versions: { select: { id: true, reason: true, templateId: true, data: true, createdAt: true } },
            shareLinks: { select: { slug: true, enabled: true, expiresAt: true, viewCount: true, createdAt: true } },
          },
        },
        subscriptions: { select: { plan: true, status: true, currentPeriodEnd: true, createdAt: true } },
        passes: { select: { plan: true, startsAt: true, endsAt: true } },
      },
    });
    return { exportedAt: new Date().toISOString(), ...user };
  }
}
