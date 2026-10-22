import type { FeedJob, JobFeed } from "@cvb/jobfeed";
import type { JobProducer } from "@cvb/queue";
import type { Queue } from "bullmq";
import { describe, expect, it } from "vitest";
import { alertDue, alertSince, pickAlertJobs } from "./alerts.js";
import { NotificationsProcessor } from "./notifications.processor.js";
import type { NotificationsStore } from "./notifications.store.js";

const job = (id: string, postedAt: string | null, extra: Partial<FeedJob> = {}): FeedJob => ({
  externalId: id,
  source: "Test",
  title: "React developer",
  company: "Acme",
  location: "Remote",
  remote: true,
  salary: "",
  url: `https://jobs.test/${id}`,
  description: "React TypeScript",
  postedAt,
  ...extra,
});

const now = new Date("2026-10-22T07:23:00Z");

describe("job alerts", () => {
  it("is due once per period", () => {
    expect(alertDue({ alerts: "off", lastAlertAt: null }, now)).toBe(false);
    expect(alertDue({ alerts: "daily", lastAlertAt: null }, now)).toBe(true);
    expect(alertDue({ alerts: "daily", lastAlertAt: new Date("2026-10-21T07:25:00Z") }, now)).toBe(true);
    expect(alertDue({ alerts: "daily", lastAlertAt: new Date("2026-10-22T01:00:00Z") }, now)).toBe(false);
    expect(alertDue({ alerts: "weekly", lastAlertAt: new Date("2026-10-19T07:00:00Z") }, now)).toBe(false);
    expect(alertSince({ alerts: "weekly", lastAlertAt: null }, now).toISOString()).toBe("2026-10-15T07:23:00.000Z");
  });

  it("keeps new, unsaved postings, best matches first", () => {
    const picked = pickAlertJobs(
      [job("a", "2026-10-20T00:00:00Z"), job("b", "2026-10-22T00:00:00Z"), job("c", "2026-10-22T01:00:00Z"), job("d", "2026-10-22T02:00:00Z")],
      { since: new Date("2026-10-21T00:00:00Z"), saved: new Set(["c"]), score: (j) => (j.externalId === "b" ? 90 : 40) },
    );
    expect(picked.map((j) => j.externalId)).toEqual(["b", "d"]);
  });
});

describe("NotificationsProcessor", () => {
  const sent: { payload: unknown; jobId?: string }[] = [];
  const producer: JobProducer = {
    enqueue: async (_q, _n, payload, options) => {
      sent.push({ payload, jobId: options?.jobId });
      return "1";
    },
  };
  const marked: string[] = [];
  const alerted: string[] = [];
  const user = { id: "u1", email: "sara@test.dev", name: "Sara" };
  const store: NotificationsStore = {
    dueReminders: async () => [
      { id: "r1", userId: "u1", title: "Follow up: Acme", dueAt: new Date("2026-10-22T07:00:00Z"), user },
      { id: "r2", userId: "u1", title: "Interview tomorrow: Beta", dueAt: new Date("2026-10-22T07:10:00Z"), user },
    ],
    markNotified: async (ids) => void marked.push(...ids),
    digestRecipients: async () => [],
    alertRecipients: async () => [
      { ...user, titles: ["React developer"], location: "", remote: true, salaryMin: null, alerts: "daily", lastAlertAt: null, cv: null },
    ],
    savedExternalIds: async () => new Set(),
    markAlerted: async (id) => void alerted.push(id),
  };
  const feed = { providers: [], search: async () => [job("x", "2026-10-22T05:00:00Z")] } as unknown as JobFeed;
  const processor = new NotificationsProcessor(store, producer, feed, {} as Queue);

  it("batches due reminders into one email per person and marks them sent", async () => {
    sent.length = 0;
    expect(await processor.reminders(now)).toEqual({ emails: 1, reminders: 2 });
    expect(sent[0]!.payload).toMatchObject({ template: "reminders", to: "sara@test.dev", items: [{ title: "Follow up: Acme" }, { title: "Interview tomorrow: Beta" }] });
    expect(marked).toEqual(["r1", "r2"]);
  });

  it("emails new matching jobs and records the alert", async () => {
    sent.length = 0;
    expect(await processor.alerts(now)).toEqual({ emails: 1, checked: 1 });
    expect(sent[0]!.payload).toMatchObject({ template: "job-alert", jobs: [{ title: "React developer", score: null }] });
    expect(sent[0]!.jobId).not.toContain(":");
    expect(alerted).toEqual(["u1"]);
  });
});
