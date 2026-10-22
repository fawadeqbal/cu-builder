import { DB } from "@cvb/db/nest";
import type { DbClient } from "@cvb/db";
import { Inject, Injectable } from "@nestjs/common";

type Person = { id: string; email: string; name: string };

export type DueReminder = { id: string; userId: string; title: string; dueAt: Date; user: Person };
export type DigestRecipient = Person & {
  applications: { status: string; createdAt: Date; appliedAt: Date | null; interviewAt: Date | null; updatedAt: Date }[];
  upcoming: { title: string; dueAt: Date }[];
};
export type AlertRecipient = Person & {
  titles: string[];
  location: string;
  remote: boolean;
  salaryMin: number | null;
  alerts: string;
  lastAlertAt: Date | null;
  /** The main CV's data (most recent non-tailored), for match scores. */
  cv: unknown;
};

/** What the notification jobs read and mark. A port, so the rules are testable without a database. */
export interface NotificationsStore {
  dueReminders(now: Date): Promise<DueReminder[]>;
  markNotified(ids: string[], at: Date): Promise<void>;
  digestRecipients(now: Date, until: Date): Promise<DigestRecipient[]>;
  alertRecipients(): Promise<AlertRecipient[]>;
  savedExternalIds(userId: string, ids: string[]): Promise<Set<string>>;
  markAlerted(userId: string, at: Date): Promise<void>;
}

export const NOTIFICATIONS_STORE = Symbol.for("cvb.worker.NotificationsStore");

const person = { id: true, email: true, name: true } as const;

@Injectable()
export class PrismaNotificationsStore implements NotificationsStore {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  dueReminders(now: Date): Promise<DueReminder[]> {
    return this.db.reminder.findMany({
      where: { doneAt: null, notifiedAt: null, dueAt: { lte: now }, user: { deletedAt: null, banned: { not: true } } },
      select: { id: true, userId: true, title: true, dueAt: true, user: { select: person } },
      orderBy: { dueAt: "asc" },
      take: 1000,
    });
  }

  async markNotified(ids: string[], at: Date): Promise<void> {
    if (ids.length) await this.db.reminder.updateMany({ where: { id: { in: ids } }, data: { notifiedAt: at } });
  }

  async digestRecipients(now: Date, until: Date): Promise<DigestRecipient[]> {
    const users = await this.db.user.findMany({
      where: {
        deletedAt: null,
        banned: { not: true },
        applications: { some: { archivedAt: null } },
        OR: [{ jobPrefs: null }, { jobPrefs: { weeklyDigest: true } }],
      },
      select: {
        ...person,
        applications: { where: { archivedAt: null }, select: { status: true, createdAt: true, appliedAt: true, interviewAt: true, updatedAt: true } },
        reminders: { where: { doneAt: null, dueAt: { gte: now, lte: until } }, orderBy: { dueAt: "asc" }, take: 10, select: { title: true, dueAt: true } },
      },
      take: 10_000,
    });
    return users.map(({ reminders, ...u }) => ({ ...u, upcoming: reminders }));
  }

  async alertRecipients(): Promise<AlertRecipient[]> {
    const rows = await this.db.jobPreferences.findMany({
      where: { alerts: { not: "off" }, user: { deletedAt: null, banned: { not: true } } },
      include: {
        user: {
          select: {
            ...person,
            resumes: { where: { deletedAt: null, archivedAt: null, baseResumeId: null }, orderBy: { updatedAt: "desc" }, take: 1, select: { data: true } },
          },
        },
      },
      take: 10_000,
    });
    return rows.map((p) => ({
      id: p.user.id,
      email: p.user.email,
      name: p.user.name,
      titles: p.titles,
      location: p.location,
      remote: p.remote,
      salaryMin: p.salaryMin,
      alerts: p.alerts,
      lastAlertAt: p.lastAlertAt,
      cv: p.user.resumes[0]?.data ?? null,
    }));
  }

  async savedExternalIds(userId: string, ids: string[]): Promise<Set<string>> {
    if (!ids.length) return new Set();
    const rows = await this.db.job.findMany({ where: { userId, externalId: { in: ids } }, select: { externalId: true } });
    return new Set(rows.map((r) => r.externalId!));
  }

  async markAlerted(userId: string, at: Date): Promise<void> {
    await this.db.jobPreferences.update({ where: { userId }, data: { lastAlertAt: at } });
  }
}
