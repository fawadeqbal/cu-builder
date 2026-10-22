import { QUEUES } from "@cvb/contracts";
import { matchJob, normalizeCV, progressSince } from "@cvb/domain";
import { JOB_FEED, type FeedJob, type JobFeed } from "@cvb/jobfeed";
import { JOB_PRODUCER, type JobProducer } from "@cvb/queue";
import { InjectQueue, Processor } from "@nestjs/bullmq";
import { Inject, Logger, type OnModuleInit } from "@nestjs/common";
import type { Job, Queue } from "bullmq";
import { ConfiguredWorkerHost } from "../common/configured-worker-host.js";
import { alertDue, alertSince, pickAlertJobs } from "./alerts.js";
import { NOTIFICATIONS_STORE, type NotificationsStore } from "./notifications.store.js";

const DAY = 24 * 3600 * 1000;
const iso = (d: Date) => d.toISOString();

/**
 * Scheduled emails: due reminders (every 15 minutes, batched per person), the Monday progress
 * digest, and job alerts from the feed (daily or weekly, per the person's preferences). Every
 * email is enqueued with a deterministic job id, so a retried run doesn't send twice.
 */
@Processor(QUEUES.notifications)
export class NotificationsProcessor extends ConfiguredWorkerHost implements OnModuleInit {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    @Inject(NOTIFICATIONS_STORE) private readonly store: NotificationsStore,
    @Inject(JOB_PRODUCER) private readonly jobs: JobProducer,
    @Inject(JOB_FEED) private readonly feed: JobFeed,
    @InjectQueue(QUEUES.notifications) private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler("reminders", { every: 15 * 60_000 }, { name: "reminders", data: {} });
    await this.queue.upsertJobScheduler("weekly-digest", { pattern: "7 8 * * 1" }, { name: "digest", data: {} });
    await this.queue.upsertJobScheduler("job-alerts", { pattern: "23 7 * * *" }, { name: "alerts", data: {} });
  }

  process(job: Job): Promise<unknown> {
    const now = new Date();
    if (job.name === "reminders") return this.reminders(now);
    if (job.name === "digest") return this.digest(now);
    if (job.name === "alerts") return this.alerts(now);
    throw new Error(`Unknown notifications job ${job.name}`);
  }

  async reminders(now: Date): Promise<{ emails: number; reminders: number }> {
    const due = await this.store.dueReminders(now);
    const byUser = new Map<string, typeof due>();
    for (const r of due) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
    for (const [userId, items] of byUser) {
      const user = items[0]!.user;
      await this.jobs.enqueue(
        QUEUES.email,
        "send",
        { template: "reminders", to: user.email, name: user.name, items: items.slice(0, 30).map((i) => ({ title: i.title, dueAt: iso(i.dueAt) })) },
        { jobId: `reminders-${userId}-${items.map((i) => i.id).join("-").slice(0, 120)}` },
      );
    }
    await this.store.markNotified(due.map((r) => r.id), now);
    if (due.length) this.logger.log(`Sent ${byUser.size} reminder emails (${due.length} reminders)`);
    return { emails: byUser.size, reminders: due.length };
  }

  async digest(now: Date): Promise<{ emails: number }> {
    const week = new Date(now.getTime() - 7 * DAY);
    const people = await this.store.digestRecipients(now, new Date(now.getTime() + 7 * DAY));
    const tag = iso(now).slice(0, 10);
    for (const p of people) {
      await this.jobs.enqueue(
        QUEUES.email,
        "send",
        {
          template: "weekly-digest",
          to: p.email,
          name: p.name,
          stats: progressSince(p.applications, week),
          upcoming: p.upcoming.map((u) => ({ title: u.title, dueAt: iso(u.dueAt) })),
        },
        { jobId: `digest-${p.id}-${tag}` },
      );
    }
    this.logger.log(`Sent ${people.length} weekly digests`);
    return { emails: people.length };
  }

  async alerts(now: Date): Promise<{ emails: number; checked: number }> {
    const searches = new Map<string, Promise<FeedJob[]>>();
    const search = (keywords: string, location: string, remote: boolean) => {
      const key = JSON.stringify([keywords.toLowerCase(), location.toLowerCase(), remote]);
      if (!searches.has(key)) searches.set(key, this.feed.search({ keywords, location: location || undefined, remote }).catch(() => []));
      return searches.get(key)!;
    };
    let emails = 0;
    const people = (await this.store.alertRecipients()).filter((p) => p.titles.length && alertDue(p, now));
    for (const p of people) {
      const found = (await Promise.all(p.titles.slice(0, 3).map((t) => search(t, p.location, p.remote)))).flat();
      const unique = [...new Map(found.map((j) => [j.externalId, j])).values()];
      const saved = await this.store.savedExternalIds(p.id, unique.map((j) => j.externalId));
      const cv = p.cv ? normalizeCV(p.cv) : null;
      const picked = pickAlertJobs(unique, {
        since: alertSince(p, now),
        saved,
        salaryMin: p.salaryMin,
        score: (j) => (cv ? matchJob(cv, { title: j.title, description: j.description }).score : null),
      });
      if (picked.length) {
        await this.jobs.enqueue(
          QUEUES.email,
          "send",
          {
            template: "job-alert",
            to: p.email,
            name: p.name,
            jobs: picked.map((j) => ({ title: j.title.slice(0, 240), company: j.company.slice(0, 200), location: j.location.slice(0, 200), url: j.url.slice(0, 2000), score: j.score })),
          },
          { jobId: `alert-${p.id}-${iso(now).slice(0, 13)}` },
        );
        emails++;
      }
      await this.store.markAlerted(p.id, now);
    }
    this.logger.log(`Job alerts: ${emails} emails for ${people.length} people`);
    return { emails, checked: people.length };
  }
}
