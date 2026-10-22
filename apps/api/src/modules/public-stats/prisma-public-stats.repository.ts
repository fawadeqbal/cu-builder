import { DB } from "@cvb/db/nest";
import type { DbClient } from "@cvb/db";
import { Inject, Injectable } from "@nestjs/common";
import type { PublicStatsRepository } from "./public-stats.repository.js";

@Injectable()
export class PrismaPublicStatsRepository implements PublicStatsRepository {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  countResumes(since?: Date): Promise<number> {
    return this.db.resume.count({ where: { deletedAt: null, ...(since ? { createdAt: { gte: since } } : {}) } });
  }

  countEvents(name: string, since?: Date): Promise<number> {
    return this.db.analyticsEvent.count({ where: { name, ...(since ? { createdAt: { gte: since } } : {}) } });
  }
}
