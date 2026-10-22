import { ContactSchema, OfferDetailsSchema, ResearchSchema, type BoardDto, type ReminderDto } from "@cvb/contracts";
import { DB } from "@cvb/db/nest";
import type { DbClient, Prisma, Reminder } from "@cvb/db";
import type { ReminderPlan } from "@cvb/domain";
import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";
import { toJobDto } from "../jobs/jobs.service.js";
import type { JobRecord, NewJob } from "../jobs/jobs.repository.js";
import type { ApplicationPatch, ApplicationRecord, ApplicationsRepository } from "./applications.repository.js";

const include = { job: true, shareLink: { select: { viewCount: true } } } as const;
type Row = Prisma.ApplicationGetPayload<{ include: typeof include }>;

const iso = (d: Date | null) => d?.toISOString() ?? null;
const SOURCES = new Set(["manual", "link", "extension", "feed"]);

const toRecord = (a: Row): ApplicationRecord => ({
  id: a.id,
  userId: a.userId,
  jobId: a.jobId,
  status: a.status,
  position: a.position,
  job: toJobDto({ ...a.job, source: (SOURCES.has(a.job.source) ? a.job.source : "manual") as JobRecord["source"] }),
  resumeId: a.resumeId,
  coverLetterId: a.coverLetterId,
  shareLinkId: a.shareLinkId,
  salaryMin: a.salaryMin,
  salaryMax: a.salaryMax,
  currency: a.currency,
  contacts: z.array(ContactSchema).catch([]).parse(a.contacts),
  notes: a.notes,
  research: ResearchSchema.catch(ResearchSchema.parse({})).parse(a.research ?? {}),
  offer: a.offer ? OfferDetailsSchema.catch(OfferDetailsSchema.parse({})).parse(a.offer) : null,
  appliedAt: iso(a.appliedAt),
  interviewAt: iso(a.interviewAt),
  deadlineAt: iso(a.deadlineAt),
  followUpDays: a.followUpDays,
  archived: Boolean(a.archivedAt),
  linkViews: a.shareLink?.viewCount ?? 0,
  createdAt: a.createdAt.toISOString(),
  updatedAt: a.updatedAt.toISOString(),
});

const toReminder = (r: Reminder): ReminderDto => ({
  id: r.id,
  applicationId: r.applicationId,
  kind: r.kind,
  title: r.title,
  dueAt: r.dueAt.toISOString(),
  doneAt: iso(r.doneAt),
});

const json = (v: unknown) => v as Prisma.InputJsonValue;
const AUTO = ["follow_up", "interview", "deadline"];

@Injectable()
export class PrismaApplicationsRepository implements ApplicationsRepository {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async list(userId: string, archived: boolean) {
    const rows = await this.db.application.findMany({
      where: { userId, archivedAt: archived ? { not: null } : null },
      include,
      orderBy: [{ status: "asc" }, { position: "asc" }],
      take: 2000,
    });
    return rows.map(toRecord);
  }

  async findOwned(id: string, userId: string) {
    const a = await this.db.application.findFirst({ where: { id, userId }, include });
    return a && toRecord(a);
  }

  countActive(userId: string) {
    return this.db.application.count({ where: { userId, archivedAt: null } });
  }

  async lastPosition(userId: string, status: string) {
    const a = await this.db.application.findFirst({ where: { userId, status }, orderBy: { position: "desc" }, select: { position: true } });
    return a?.position ?? null;
  }

  async positionOf(id: string, userId: string) {
    const a = await this.db.application.findFirst({ where: { id, userId }, select: { position: true } });
    return a?.position ?? null;
  }

  async existsForJob(userId: string, jobId: string) {
    const a = await this.db.application.findFirst({ where: { userId, jobId }, select: { id: true } });
    return a?.id ?? null;
  }

  async create(input: { userId: string; jobId: string; status: string; position: number; resumeId: string | null; appliedAt: Date | null }) {
    return toRecord(await this.db.application.create({ data: input, include }));
  }

  async createWithJob(job: NewJob & { externalId?: string | null; salary?: string; remote?: boolean }, app: { status: string; position: number; resumeId: string | null }) {
    return toRecord(
      await this.db.application.create({
        data: {
          status: app.status,
          position: app.position,
          resumeId: app.resumeId,
          user: { connect: { id: job.userId } },
          job: {
            create: {
              userId: job.userId,
              title: job.title,
              company: job.company,
              location: job.location,
              url: job.url,
              description: job.description,
              source: job.source,
              externalId: job.externalId ?? null,
              salary: job.salary ?? "",
              remote: job.remote ?? false,
            },
          },
        },
        include,
      }),
    );
  }

  async update(id: string, patch: ApplicationPatch) {
    const { contacts, research, offer, ...rest } = patch;
    return toRecord(
      await this.db.application.update({
        where: { id },
        data: {
          ...rest,
          ...(contacts !== undefined ? { contacts: json(contacts) } : {}),
          ...(research !== undefined ? { research: json(research) } : {}),
          ...(offer !== undefined ? { offer: offer === null ? (null as unknown as Prisma.InputJsonValue) : json(offer) } : {}),
        },
        include,
      }),
    );
  }

  async delete(id: string) {
    await this.db.application.delete({ where: { id } });
  }

  async board(userId: string): Promise<BoardDto | null> {
    const b = await this.db.trackerBoard.findUnique({ where: { userId } });
    return b ? { columns: b.columns as BoardDto["columns"] } : null;
  }

  async saveBoard(userId: string, board: BoardDto) {
    await this.db.trackerBoard.upsert({ where: { userId }, create: { userId, columns: json(board.columns) }, update: { columns: json(board.columns) } });
  }

  async moveColumn(userId: string, from: string, to: string) {
    await this.db.application.updateMany({ where: { userId, status: from }, data: { status: to } });
  }

  async syncAutoReminders(userId: string, applicationId: string, plans: ReminderPlan[]) {
    const now = new Date();
    await this.db.$transaction([
      this.db.reminder.deleteMany({ where: { userId, applicationId, kind: { in: AUTO }, doneAt: null } }),
      this.db.reminder.createMany({
        data: plans.filter((p) => p.dueAt > now).map((p) => ({ userId, applicationId, kind: p.kind, title: p.title, dueAt: p.dueAt })),
      }),
    ]);
  }

  async reminders(userId: string, from: Date, to: Date) {
    return (await this.db.reminder.findMany({ where: { userId, dueAt: { gte: from, lte: to } }, orderBy: { dueAt: "asc" }, take: 500 })).map(toReminder);
  }

  async createReminder(input: { userId: string; title: string; dueAt: Date; applicationId: string | null }) {
    return toReminder(await this.db.reminder.create({ data: { ...input, kind: "custom" } }));
  }

  async setReminderDone(id: string, userId: string, done: boolean) {
    const r = await this.db.reminder.findFirst({ where: { id, userId } });
    if (!r) return null;
    return toReminder(await this.db.reminder.update({ where: { id }, data: { doneAt: done ? new Date() : null } }));
  }

  async deleteReminder(id: string, userId: string) {
    return (await this.db.reminder.deleteMany({ where: { id, userId } })).count > 0;
  }
}
