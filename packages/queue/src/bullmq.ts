import { type JobName, type JobPayload, type QueueName } from "@cvb/contracts";
import { type ConnectionOptions, type JobsOptions, type Queue } from "bullmq";
import { parseJob, type EnqueueOptions, type JobProducer } from "./producer";

/** Retries with backoff and bounded history, the same for every queue. */
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2_000 },
  removeOnComplete: { age: 24 * 3600, count: 1_000 },
  removeOnFail: { age: 7 * 24 * 3600 },
};

/**
 * Connection settings for every queue and worker. BullMQ opens (and duplicates) the
 * ioredis connections itself; workers need `maxRetriesPerRequest: null`.
 */
export function redisConnection(url: string): ConnectionOptions {
  return { url, maxRetriesPerRequest: null, enableReadyCheck: true };
}

/** BullMQ adapter for the JobProducer port. */
export class BullMqJobProducer implements JobProducer {
  constructor(private readonly queues: ReadonlyMap<QueueName, Queue>) {}

  async enqueue<Q extends QueueName, N extends JobName<Q>>(
    queue: Q,
    name: N,
    payload: JobPayload<Q, N>,
    options: EnqueueOptions = {},
  ): Promise<string> {
    const target = this.queues.get(queue);
    if (!target) throw new Error(`Queue "${queue}" is not registered`);
    const data = parseJob(queue, name, payload);
    const job = await target.add(name, data, {
      ...DEFAULT_JOB_OPTIONS,
      jobId: options.jobId,
      delay: options.delayMs,
      priority: options.priority,
    });
    return job.id ?? "";
  }
}
