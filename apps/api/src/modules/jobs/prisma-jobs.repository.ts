import { DB } from "@cvb/db/nest";
import type { DbClient, Job, Prisma } from "@cvb/db";
import { Inject, Injectable } from "@nestjs/common";
import type { JobPatch, JobRecord, JobsRepository, NewJob } from "./jobs.repository.js";

const SOURCES = new Set(["manual", "link", "extension", "feed"]);
const toRecord = (j: Job): JobRecord => ({
  id: j.id,
  userId: j.userId,
  title: j.title,
  company: j.company,
  location: j.location,
  url: j.url,
  description: j.description,
  source: (SOURCES.has(j.source) ? j.source : "manual") as JobRecord["source"],
  createdAt: j.createdAt,
  updatedAt: j.updatedAt,
});

@Injectable()
export class PrismaJobsRepository implements JobsRepository {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async list(userId: string) {
    return (await this.db.job.findMany({ where: { userId, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 500 })).map(toRecord);
  }

  async findOwned(id: string, userId: string) {
    const j = await this.db.job.findFirst({ where: { id, userId, deletedAt: null } });
    return j && toRecord(j);
  }

  async findByUrl(userId: string, url: string) {
    const j = await this.db.job.findFirst({ where: { userId, url, deletedAt: null } });
    return j && toRecord(j);
  }

  async create(input: NewJob) {
    return toRecord(await this.db.job.create({ data: input }));
  }

  async update(id: string, patch: JobPatch) {
    return toRecord(await this.db.job.update({ where: { id }, data: patch }));
  }

  async softDelete(id: string) {
    await this.db.job.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async saveMatch({ userId, resumeId, jobId, score, result }: { userId: string; resumeId: string; jobId: string; score: number; result: unknown }) {
    const json = result as Prisma.InputJsonValue;
    await this.db.match.upsert({
      where: { resumeId_jobId: { resumeId, jobId } },
      create: { userId, resumeId, jobId, score, result: json },
      update: { score, result: json, createdAt: new Date() },
    });
  }
}
